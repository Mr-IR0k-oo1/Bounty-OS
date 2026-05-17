build:
	cargo build --release

run:
	docker-compose up -d

stop:
	docker-compose down

logs:
	docker-compose logs -f

migrate:
	cargo run --bin bountyos-server -- migrate

seed:
	cargo run --bin bountyos-server -- seed

clean:
	cargo clean
	docker-compose down -v

fmt:
	cargo fmt --all

check:
	cargo check

clippy:
	cargo clippy -- -D warnings

install-tools:
	bash scripts/utils/tool_check.sh

generate-certs:
	bash scripts/utils/generate_certs.sh

setup:
	cp .env.example .env
	echo "Please edit .env with your configuration"
