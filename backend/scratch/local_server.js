const app = require('../dist/api/index.js').default;

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Test backend server running on http://localhost:${port}`);
});
