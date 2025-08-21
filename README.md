# Blog Backend API

Node.js backend API for the professional blog website.

## Features

- User authentication (register, login, profile)
- Blog post management (CRUD operations)
- Comment system with replies
- Admin panel with user and content management
- File upload support
- JWT-based authentication
- MySQL database integration

## Tech Stack

- Node.js
- Express.js
- MySQL (AWS RDS)
- JWT
- Multer (file uploads)
- bcryptjs (password hashing)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/madhucm17/ReactBackend.git
cd ReactBackend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create a `config.env` file with your database credentials:
```env
# Database Configuration (AWS RDS MySQL)
DB_HOST=database-1.cjcg8syqwox5.ap-south-1.rds.amazonaws.com
DB_USER=ProjectDatabase
DB_PASSWORD=madhupassword
DB_NAME=projectdb
DB_PORT=3306

# Server Configuration
PORT=8081
NODE_ENV=development

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here
```

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Deployment

### Manual Deployment
```bash
chmod +x deploy.sh
./deploy.sh
```

### PM2 Deployment
```bash
pm2 start server.js --name ReactBackend
pm2 startup
pm2 save
```

### Jenkins CI/CD
The project includes a Jenkinsfile for automated deployment.

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create new post
- `GET /api/posts/:id` - Get single post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

- `GET /api/comments/:postId` - Get comments for post
- `POST /api/comments` - Add comment
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment

## Default Admin Account

- Email: admin@blog.com
- Password: admin123
