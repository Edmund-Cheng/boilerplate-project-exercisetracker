const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false  }));

// Mongo setup
const mongoose = require('mongoose');
const mySecret = process.env['MONGO_URI'];
mongoose.connect(mySecret, { useNewUrlParser: true, useUnifiedTopology: true });
const Schema = mongoose.Schema;

var userSchema = new Schema({
  username: { type: String, required: true }
});
// - create a model 
var User = mongoose.model("User", userSchema);

var exerciseSchema = new Schema({
  username: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: Date,
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
// - create a model 
var Exercise = mongoose.model("Exercise", exerciseSchema);



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});

// Handle post '/api/users'
function findUserByName (req, res, next) {
  const query = User.findOne({ username: req.body.username });
  query.then((user) => {
      req.user = user;
      next();
    }).catch((err) => {
    console.error('Error finding User:', err);
    next(err);
    })      
}

async function saveUser (req, res, next) {
  try {
    if (!req.user) {
      const newUser = new User({
          username: req.body.username
        });
        
      const savedUser = await newUser.save();
      console.log('User saved successfully:', savedUser);
  
      req.user = savedUser; 
    } 
    next();
  } catch (err) {
    console.error('Error saving User:', err);
    next(err);
  };
}

app.post('/api/users', findUserByName, saveUser, (req, res) => {
  console.log(JSON.stringify(req.user));
  res.json({
    username: req.user.username,
    _id: req.user._id
  });
});

// Handle get '/api/users'
async function getAllUsers(){
  try {
    const allUsers = await User.find({});
    return allUsers;
  } catch (err) {
    console.error('Error fetching all users:', err);
    return [];
  }
}

app.get('/api/users', (req, res) => {
  getAllUsers().then((users) => {
    console.log(JSON.stringify(users));
    res.json(users);
  })
});

// Handle post /api/users/:_id/exercises
function findUserById (req, res, next) {  
  const query = User.findById({ _id: req.params._id });
  query.then((user) => {
      req.user = user;
      next();
    }).catch((err) => {
    console.error('Error finding User:', err);
    next(err);
    })      
}

async function saveExercise (req, res, next) {
  try {
    const username = req.user.username;
    const user_id = req.params._id;
    const description = req.body.description;
    const duration = parseInt(req.body.duration);
    const date = req.body.date? new Date(req.body.date) : new Date();
    
    const newExercise = new Exercise({
      username: username,
      description: description,
      duration: duration,
      date: date,
      user_id: user_id
    });
        
    const savedExercise = await newExercise.save();
    console.log('Exercise saved successfully:', savedExercise);
    req.exercise = savedExercise; 
    next();
  } catch (err) {
    console.error('Error saving Exercise:', err);
    next(err);
  };
}

app.post('/api/users/:_id/exercises', findUserById, saveExercise, (req, res) => {
  console.log(JSON.stringify(req.exercise));
  res.json({
    username: req.exercise.username,
    description: req.exercise.description,
    duration: req.exercise.duration,
    date: req.exercise.date.toDateString(),
    _id: req.exercise.user_id
  });
});

// Handle get /api/users/:_id/logs
// findUserById in above will be reused

async function findAllExerciseByUserId (req, res, next) {
  try {
    const query = { user_id: req.user._id };

    // Get the optional query parameters: from, to and limit
    const from = req.query.from;
    const to = req.query.to;
    const limit = parseInt(req.query.limit);

    if (from && to) {
      query.date = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }

    const aggregationPipeline = [
      { $match: query },
    ];

    if (limit && limit > 0) {
      aggregationPipeline.push({ $limit: limit});
    }
    
    //const exercise = await Exercise.find(query);
    const exercise = await Exercise.aggregate(aggregationPipeline);
    const count = await Exercise.countDocuments(query);
    req.exercise = exercise;
    req.count = count;

    next();    
  } catch (err) {
    console.error('Error finding Exercise:', err);
    next(err);
  };
}

app.get('/api/users/:_id/logs', findUserById, findAllExerciseByUserId, (req, res) => {
   
  const username = req.user.username;
  const count = parseInt(req.count);
  const userId = req.user._id;
  const log = req.exercise.map((item) => ({
    description: item.description,
    duration: item.duration,
    date: item.date.toDateString()
  }));
  
  res.json({
    username: username,
    count: count,
    _id: userId,
    log: log
  });
});
