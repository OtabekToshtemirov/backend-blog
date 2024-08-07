# Project Name

## Description
A brief description of your project, what it does, and its main features.

## Technologies Used
- JavaScript
- Node.js
- Express
- MongoDB
- Mongoose
- Multer
- CORS
- dotenv

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/OtabekToshtemirov/backend-blog.git
    cd your-repo-name
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

3. Create a `.env` file in the root directory and add your MongoDB credentials:
    ```plaintext
    MONGODB_USERNAME=yourUsername
    MONGODB_PASSWORD=yourPassword
    ```

4. Start the server:
    ```bash
    npm start
    ```

## API Endpoints

### User Routes
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login a user
- `GET /auth/me` - Get the authenticated user's details

### Post Routes
- `GET /tags` - Get the last tags
- `GET /posts` - Get all posts
- `GET /posts/:id` - Get a single post by ID
- `POST /posts` - Create a new post
- `PATCH /posts/:id` - Update a post by ID
- `DELETE /posts/:id` - Delete a post by ID

### Comment Routes
- `GET /posts/:postId/comments` - Get comments for a post
- `POST /posts/:postId/comments` - Add a comment to a post
- `GET /comments` - Get all comments

### File Upload Route
- `POST /upload` - Upload an image file

## Usage

1. Register a new user or login with an existing user.
2. Create, update, delete, and view posts.
3. Add comments to posts.
4. Upload images to the server.

## Contributing
1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature-branch`).
5. Open a pull request.

## License
This project is licensed under the MIT License. See the `LICENSE` file for details.