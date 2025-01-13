const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());



app.get('/', (req, res) => {
  res.send('Welcome to SkillSpace API');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
