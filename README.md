# Lolev Beer - Payload CMS

This is a Payload CMS project for the Lolev Beer brewery website.

## Quick Start - Local Setup

To spin up this project locally, follow these steps:

### Development

1. Clone the repo
2. `cp .env.example .env` to copy the example environment variables
3. Configure your database connection in `.env`
4. `pnpm install && pnpm dev` to install dependencies and start the dev server
5. Open `http://localhost:3000` to open the app in your browser

Follow the on-screen instructions to login and create your first admin user.

### Docker (Optional)

If you prefer to use Docker for local development:

1. Modify the `DATABASE_URI` in your `.env` file
2. Run `docker-compose up` to start the database (optionally pass `-d` to run in the background)

## Collections

- **Users** - Auth-enabled collection with admin panel access
- **Media** - Uploads enabled collection with pre-configured sizes
- **Beers** - Beer catalog with styles, ABV, pricing
- **Events** - Brewery events calendar
- **Food** - Food truck schedule
- **Locations** - Brewery locations
- **Menus** - Draft and can menus per location

## Questions

If you have any issues or questions, reach out on [Discord](https://discord.com/invite/payload) or start a [GitHub discussion](https://github.com/payloadcms/payload/discussions).
