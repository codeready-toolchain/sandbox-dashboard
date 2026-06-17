import { Label, LabelGroup, Content } from "@patternfly/react-core";
import type { AddedCredential } from "../../utils/openclaw-providers";

type CredentialListProps = {
  credentials: AddedCredential[];
  onDelete: (providerId: string) => void;
};

export function CredentialList({ credentials, onDelete }: CredentialListProps) {
  return (
    <div style={{ marginTop: "16px" }}>
      <Content
        component="p"
        style={{ marginBottom: "8px", fontWeight: 500, fontSize: "14px" }}
      >
        Added credentials:
      </Content>
      <LabelGroup>
        {credentials.map((cred) => (
          <Label
            key={cred.provider.id}
            color="blue"
            variant="outline"
            onClose={() => onDelete(cred.provider.id)}
          >
            {cred.provider.name}
          </Label>
        ))}
      </LabelGroup>
    </div>
  );
}
