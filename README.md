# Incridea Server v2

Incridea Server v2 is the backend service powering **Incridea**, the annual techno-cultural fest organized by NMAM Institute of Technology.  
This repository contains the server-side codebase built with **TypeScript**, **Node.js**, and **Prisma ORM**, designed to provide APIs for event management, user registration, and database operations.

---

## 🚀 Features

- **TypeScript-based backend** for type safety and scalability
- **Prisma ORM** for database modeling and queries
- **RESTful APIs** to handle event data, participants, and admin operations
- **Database population script** (`populate-database.js`) for seeding initial data
- Environment configuration via `.env` file
- Ready-to-deploy setup with **Vercel**

---

## 📂 Project Structure
incridea-server-v2/

├── prisma/                # Prisma schema and migrations

├── src/                   # Application source code

├── .env.example           # Example environment variables

├── package.json            # Dependencies and scripts

├── tsconfig.json           # TypeScript configuration

├── seed.js    # Script to seed database

└── README.md               # Project documentation


---

## ⚙️ Tech Stack

- **Language:** TypeScript (91.2%), JavaScript (7.7%)
- **Database:** PostgreSQL (via Prisma, PLpgSQL)
- **Runtime:** Node.js
- **Deployment:** Vercel

---

## 🔧 Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/Incridea-NMAMIT/incridea-server-v2.git
   cd incridea-server-v2
2. **Install Dependencies**
   ```bash
   npm install
3. **Configure environment variables**
    - Copy .env.example to .env
    - Update values (database URL, secrets, etc.)
4. **Seed the database**
   ```bash
   npx prisma db seed
5. **Start development server**
   ```bash
   npm run dev

**📡 API Endpoints**

The server exposes RESTful APIs for:

- Events – Create, read, update, delete event details

- Users – Manage participants and admins

- Registrations – Handle event registrations
  
**🛠 Scripts**

npm run dev – Start development server
npm run build – Compile TypeScript to JavaScript
npm run start – Run production server
npx prisma migrate dev – Apply database migrations
node populate-database.js – Seed database with sample data

**📜 License**

This project is licensed under the MIT License.
You are free to use, modify, and distribute this software in compliance with the license terms.
See the [Looks like the result wasn't safe to show. Let's switch things up and try something else!] file for details.
