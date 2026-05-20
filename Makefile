.PHONY: dev lint test build image run-image clean

dev:
	npm run dev

lint:
	npm run lint
	npm run format:check

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
