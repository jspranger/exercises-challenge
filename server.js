const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const mongoose = require('mongoose')

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  dbName: 'exercises'
}).then(db => {
  const userExercisesSchema = {
    _id: { type: Number, required: true },
    username: { type: String, required: true },
    log: [{
      description: { type: String, required: true },
      duration: { type: Number, required: true },
      date: Date
    }]
  };
  
  const UserExercises = mongoose.model('UserExercises', userExercisesSchema);
  
  app.use(express.static('public'))
  
  app.get('/', (req, res) => res.sendFile(__dirname + '/views/index.html'));
  
  const userExists = (req, res, next) => {
    UserExercises.findOne({ userName : req.body.username }, (err, result) => {
      if (err) {
        console.log(err);
      }
      
      return result ? res.json({ username: result.username, _id: result._id }) : next();
    });
  };
  
  const userInsert = (req, res, next) => {
    UserExercises.find().count((err, count) => {
      if (err) {
        console.log(err);
      }

      UserExercises.create({ _id: count + 1, username: req.body.username }, (err, result) => {
        if (err) {
          console.log(err);
        }
        
        return result ? res.json({ username: result.username, _id: result._id }) : next();
      });
    });
  };
  
  app.post('/api/exercise/new-user', userExists, userInsert);
  
  const userList = (req, res, next) => {
    UserExercises.find((err, result) => {
      if (err) {
        console.log(err);
      }

      return result ?
        res.json(result.map((value) => {
          return {
            _id: value._id,
            username: value.username
          }
        })) :
        next();
    });
  };
  
  app.get('/api/exercise/users', userList);
  
  const testDate = (date) => date instanceof Date && !isNaN(date);
  
  const userExerciseInsert = (req, res, next) => {
    UserExercises.findOneAndUpdate({
      _id: req.body.userId
    }, {
      '$push': { log: {
        description: req.body.description,
        duration: req.body.duration,
        date: (req.body.date !== undefined && testDate(new Date(req.body.date))) ?
              new Date(req.body.date) :
              new Date()
      } }
    }, {
      new: true
    }, (err, result) => {
      if (err) {
        console.log(err);
      }
      
      return result ?
        res.json({
            _id: result._id,
            username: result.username,
            log: result.log.map((value) => {
              return {
                description: value.description,
                duration: value.duration,
                date: value.date
              }
            })
          }) :
        next();
    })
  };
  
  app.post('/api/exercise/add', userExerciseInsert);
  
  const userSelect = (req, res, next) => {
    UserExercises.findOne({
      _id: req.query.userId
    }, (err, result) => {
      if (err) {
        console.log(err);
      }
      
      if (result) {
        let jsonObj = {
          username: result.username,
          _id: result.id,
          log: [...result.log],
          count: result.log.length
        }

        const from = req.query.from;
        const to = req.query.to;
        const limit = req.query.limit;
        
        if (from !== undefined && testDate(new Date(from))) {
          jsonObj.log = jsonObj.log.filter(value => {
            if (value.date >= new Date(from)) {
              return value;
            }
          });
          
          //jsonObj.count = jsonObj.log.length; // I don't think this is what is asked
        }
        
        if (to !== undefined && testDate(new Date(to))) {
          jsonObj.log = jsonObj.log.filter(value => {
            if (value.date <= new Date(to)) {
              return value;
            }
          });
          
          jsonObj.count = jsonObj.log.length;
        }      

        if (limit !== undefined && typeof parseInt(limit) === 'number') {
          jsonObj.log.splice(parseInt(limit), jsonObj.log.length - 1);
          
          //jsonObj.count = jsonObj.log.length; // I don't think this is what is asked
        }

        return res.json(jsonObj);
      }
      
      return next();
    });
  };
  
  app.get('/api/exercise/log', userSelect);

  // Not found middleware
  app.use((req, res, next) => {
    return next({status: 404, message: 'not found'})
  })

  // Error Handling middleware
  app.use((err, req, res, next) => {
    let errCode, errMessage

    if (err.errors) {
      // mongoose validation error
      errCode = 400 // bad request
      const keys = Object.keys(err.errors)
      // report the first validation error
      errMessage = err.errors[keys[0]].message
    } else {
      // generic or custom error
      errCode = err.status || 500
      errMessage = err.message || 'Internal Server Error'
    }
    res.status(errCode).type('txt')
      .send(errMessage)
  })
})
.catch((err) => {
  console.log(err);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
