# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Backend / Database configuration (Railway MySQL)

The backend uses a MySQL database hosted on Railway. Configuration is done via environment variables.

- **Required environment variables**:
  - `MYSQL_HOST`
  - `MYSQL_PORT` (usually `3306`)
  - `MYSQL_USER`
  - `MYSQL_PASSWORD`
  - `MYSQL_DATABASE`
  - `JWT_SECRET`

### Local development

1. Create a `.env` file in the `my-app` folder with values from your Railway MySQL plugin:

   ```bash
   MYSQL_HOST=yourhost.railway.app
   MYSQL_PORT=3306
   MYSQL_USER=youruser
   MYSQL_PASSWORD=yourpassword
   MYSQL_DATABASE=yourdb
   JWT_SECRET=some-strong-secret
   ```

2. Install backend dependencies (run in the `my-app` folder):

   ```bash
   npm install
   ```

3. Start the backend server (for example, if you run it with Node):

   ```bash
   node server.js
   ```

4. In another terminal, run the React app as usual with `npm start`.

### Railway deployment

- In Railway, add the same environment variables to your app service. If you added a MySQL plugin, Railway can automatically provide `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE`; you only need to add `JWT_SECRET` yourself.
- Deploy your app, and the backend will connect to the Railway MySQL database using those variables.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify


This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)



PHASE 2:
create a database to be able to store the Usernames Passwords and Books going in and out
As more books are added the more we need toadd to the sataic array
Breaking it up to 3 TODO
TODO 1: Learn how to use SQL and how to store and encrypt passwords
TODO 2: Find how to store everything via local or maybe in cloud 
TODO 3  Start Testing and send to trusted Beta Testers. Launch a Version 3 Correctly spelled and checked.