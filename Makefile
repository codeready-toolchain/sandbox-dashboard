.PHONY: dev \
	start-keycloak \
	lint lint-fix \
	install-e2e test-unit test-e2e test-e2e-ui test-all \
	build image run-image clean

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
	npm run typecheck
	npm run lint
	npm run format:check

lint-fix:
	npm run lint -- --fix
	npm run format

install-e2e:
	npm ci --prefix e2e
	npx --prefix e2e playwright install

test-unit:
	npm run test

test-e2e:
	npm --prefix e2e test

test-e2e-ui:
	npm --prefix e2e run test:ui

test-all: test-unit test-e2e

build:
	npm run build

image:
	podman build --tag sandbox-dashboard --file deploy/Containerfile .

run-image:
	podman run --rm -p 8080:8080 sandbox-dashboard

clean:
	rm -rf dist node_modules e2e/node_modules e2e/test-results e2e/playwright-report
