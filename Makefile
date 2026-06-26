.PHONY: dev lint lint-fix test build image run-image clean

dev:
	npm run dev

start-keycloak:
	podman run \
		--rm \
		-p 8080:8080 \
		--env KC_BOOTSTRAP_ADMIN_USERNAME=admin \
		--env KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
		--volume ./src/mocks/keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json:Z \
		quay.io/keycloak/keycloak:latest start-dev --import-realm

lint:
	npm run lint
	npm run format:check

lint-fix:
	npm run lint -- --fix
	npm run format

test:
	npm run test

build:
	npm run build

image:
	podman build -t sandbox-dashboard -f Containerfile .

run-image:
	podman run --rm -p 8080:8080 sandbox-dashboard

clean:
	rm -rf dist node_modules
