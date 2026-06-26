import type { JsonCredentialSchema } from "../types";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const schema = {
  type: "object",
  discriminator: { propertyName: "type" },
  oneOf: [
    {
      type: "object",
      properties: {
        type: { type: "string", const: "authorized_user" },
        client_id: { type: "string" },
        client_secret: { type: "string" },
        refresh_token: { type: "string" },
        quota_project_id: { type: "string" },
      },
      required: ["type", "client_id", "client_secret", "refresh_token"],
    },
    {
      type: "object",
      properties: {
        type: { type: "string", const: "service_account" },
        project_id: { type: "string" },
        private_key_id: { type: "string" },
        private_key: { type: "string" },
        client_email: { type: "string", format: "email" },
        client_id: { type: "string" },
        auth_uri: { type: "string", format: "uri" },
        token_uri: { type: "string", format: "uri" },
      },
      required: [
        "type",
        "project_id",
        "private_key_id",
        "private_key",
        "client_email",
        "client_id",
        "auth_uri",
        "token_uri",
      ],
    },
  ],
};

const ajv = new Ajv({ allErrors: true, discriminator: true, strict: true });
addFormats(ajv);
const schemaValidator = ajv.compile<JsonCredentialSchema>(schema);

const stripLeadingSlash = (path: string): string =>
  path.startsWith("/") ? path.slice(1) : path;

export const openclawVertexJsonValidator = (rawJson: string): string[] => {
  if (rawJson === "") {
    return [];
  }

  let data: JsonCredentialSchema;
  try {
    data = JSON.parse(rawJson);
  } catch {
    return ["Please input valid JSON."];
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return ["Please input a valid JSON object."];
  }

  if (!schemaValidator(data)) {
    if (schemaValidator.errors) {
      const errMsgs: string[] = [];
      const missingRequiredProperties: string[] = [];
      const invalidFormatErrMsgs: string[] = [];
      const invalidTypeErrMsgs: string[] = [];
      const credType = (data as Record<string, unknown>).type;

      if (credType === undefined) {
        return ['The "type" property is required'];
      } else if (
        credType !== "authorized_user" &&
        credType !== "service_account"
      ) {
        return [
          'The "type" property must be "authorized_user" or "service_account"',
        ];
      }

      for (const err of schemaValidator.errors) {
        switch (err.keyword) {
          case "required":
            missingRequiredProperties.push(err.params.missingProperty);
            break;
          case "type":
            invalidTypeErrMsgs.push(
              `The "${stripLeadingSlash(
                err.instancePath,
              )}" field must be of the "${err.params.type}" type.`,
            );
            break;
          case "format":
            switch (err.params.format) {
              case "email":
                invalidFormatErrMsgs.push(`Invalid email format specified.`);
                break;
              case "uri":
                invalidFormatErrMsgs.push(
                  `Invalid URI specified in "${stripLeadingSlash(
                    err.instancePath,
                  )}".`,
                );
                break;
            }
            break;
          default:
            errMsgs.push(
              `Invalid property "${stripLeadingSlash(err.instancePath)}".`,
            );
        }
      }

      if (missingRequiredProperties.length === 1) {
        errMsgs.push(
          `The "${missingRequiredProperties[0]}" property is required.`,
        );
      } else if (missingRequiredProperties.length > 1) {
        const formatter = new Intl.ListFormat("en", {
          style: "long",
          type: "conjunction",
        });

        errMsgs.push(
          `The ${formatter.format(
            missingRequiredProperties.map((property) => `"${property}"`),
          )} properties are required.`,
        );
      }

      if (invalidTypeErrMsgs.length > 0) {
        errMsgs.push(invalidTypeErrMsgs.join(" "));
      }

      if (invalidFormatErrMsgs.length > 0) {
        errMsgs.push(invalidFormatErrMsgs.join(" "));
      }

      return errMsgs;
    }
  }

  return [];
};
