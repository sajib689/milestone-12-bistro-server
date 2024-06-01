const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000
const stripe = require('stripe')(process.env.Stripe_Secret_Key)
const app = express();
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true,
}));
app.use(cookieParser())


const uri = `mongodb+srv://${process.env.Db_username}:${process.env.Db_password}@cluster0.2m0rny5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
const verifyJWT = async (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({message:'unauthorized access'})
  }
  jwt.verify(token, process.env.Access_token, (err, decoded) => {
    if(err) {
      return res.status(500).send({message: 'unauthorized access'})
    }
    req.decoded = decoded
    next()

  })
}

async function run() {
  try {
    const menuCollection =await client.db('bistro').collection('menu');
    const cartsCollection =await client.db('bistro').collection('carts')
    const usersCollection = await client.db('bistro').collection('users')
    const paymentsCollection = await client.db('bistro').collection('payments')
    // jwt api
    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email
      const query = {email: email}
      const user = await usersCollection.findOne(query)
      const isAdmin= user?.role == 'admin'
      if(!isAdmin) {
        return res.status(403).status({message: 'forbidden access'})
      }
      next()
    }
    app.post('/jwt', async (req, res) => {
      const user = req.body
     const token =await jwt.sign(user, process.env.Access_token,{expiresIn: '1h'})
      res
      .cookie('token', token, {
        httpOnly: true,
        secure: false,
      })
      .send({success: true})
    })
    app.post('/logout', async (req, res) => {
      const user = req.body
      res.
      clearCookie('token', {
        maxAge: 0
      })
      .send({success: true})
    })
    // users api
    app.post('/users', async (req, res) => {
      const userData = req.body
      const email = userData?.email
      if(!email) {	
        return res.status(400).send({ message: 'user already exists'})
      }
      const checkUser = await usersCollection.findOne({ email: email})
      if(checkUser) {
        return res.status(400).send({ message: 'user already exists'})
      } else {
        const result = await usersCollection.insertOne(userData)
      res.send(result)
      }
      
    })
    app.get('/users',verifyJWT,verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    app.get('/users/:id',verifyJWT,verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await usersCollection.findOne(query).toArray()
      res.send(result)
    })

    app.delete('/users/:id',verifyJWT,verifyAdmin, async (req, res) => { 
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await usersCollection.deleteOne(query)
      res.send(result)
    })
    app.patch('/users/admin/:id',verifyJWT,verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const options = {upsert: true}
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc,options)
      res.send(result)
    })
    app.get('/users/admin/:email',verifyJWT,verifyAdmin, async (req, res) => {
      const email = req.params.email
      if(email !== req.decoded.email) {
        return res.status(403).send({ message: 'Invalid email address'})
      }
      const query = { email: email}
      const user = await usersCollection.findOne(query)
      let admin = false 
      if(user) {
        admin = user.role === 'admin'
      }
      res.send({admin})
    })
    
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray()
      res.send(result)
    })
    app.post('/menu',verifyJWT,verifyAdmin, async (req, res) => {
      const query = req.body 
      const result = await menuCollection.insertOne(query)
      res.send(result)
    })
    app.get('/menu/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await menuCollection.findOne(query);
    
        if (!result) {
          return res.status(404).send({ message: 'Item not found' });
        }
    
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'An error occurred' });
      }
    });
    app.delete('/menu/:id',verifyJWT,verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })
   
    
    
    app.put('/menu/:id', async (req, res) => {
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const options = {upsert: true}
      const cursor = req.body
      const updateDoc = {
        $set:{
          name: cursor.name,
          category: cursor.category,
          price: cursor.price,
          recipe: cursor.recipe,
          image: cursor.image,
        }
      }
      const result = await menuCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })
    app.post('/carts', async (req, res) =>{
      const query = req.body
      const result = await cartsCollection.insertOne(query)
      res.send(result)
    })
    app.get('/carts',verifyJWT, async (req, res) =>{
      const email = req.query.email
      const result = await cartsCollection.find({ email: email}).toArray()
      res.send(result)
    })
    app.get('/carts/:id',verifyJWT, async (req, res) => {
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await cartsCollection.findOne(query)
      res.send(result)
    })
    app.delete('/carts/:id', async (req, res) =>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await cartsCollection.deleteOne(query)
      res.send(result)
    })
    app.post('/create-payment-intent', async (req, res) => {
      const {price} = req.body
      const amount = parseInt(price * 100)
      console.log(amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        payment_method_types: ['card'],
        currency: "usd",
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    app.post('/payments', async (req, res) => {
      const query = req.body
      const result = await paymentsCollection.insertOne(query)
      const cursor = {
      _id: {
        $in: query.cartIds.map(id => new ObjectId(id))
      }
      }
      const deleteResult = await cartsCollection.deleteMany(cursor)
      res.send({result,deleteResult});
    })
    app.get('/payments', verifyJWT, async (req, res) => {
      const email = req.query.email
      if(email !== req.decoded.email) {
        return res.status(403).send({message: 'Invalid email address'})
      }
      const result = await paymentsCollection.find({email: email}).toArray()
      res.send(result)
    })
    app.get('/admin-stats', async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount()
      const menuItems = await menuCollection.estimatedDocumentCount()
      const orders = await paymentsCollection.estimatedDocumentCount()
     const result = await paymentsCollection.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: {$sum: '$price'}
        }
      }
     ]).toArray()
     const revenue = result.length > 0 ? result[0].totalRevenue : 0
      res.send({
        users,
        menuItems,
        orders,
        revenue

      })
    })
    app.get('/order-stats',verifyJWT,verifyAdmin, async (req, res) => {
      try {
        const result = await paymentsCollection.aggregate([
          {
            $unwind: '$menuItemIds'
          },
          {
            $lookup: {
              from: 'menu',
              localField: 'menuItemIds',
              foreignField: '_id',
              as: 'menuItems',
            },
          },
          {
            $unwind: '$menuItems',
          },
          {
            $group: {
              _id: '$menuItems.category',
              quantity: {
                $sum: 1
              },
              revenue: {
                $sum: '$menuItems.price'
              }
            }
          },
          {
            $project: {
              _id: 0,
              category: '$_id',
              quantity: '$quantity',
              revenue: '$revenue'
            }
          }
        ]).toArray();
        
        res.send(result);
      } catch (error) {
        console.error('Error fetching order stats:', error);
        res.status(500).send({ message: 'An error occurred while fetching order stats.' });
      }
    });
    
    } finally {
  
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Server is listening')
})

app.listen(port, () => {
    console.log(`Listen on ${port}`)
})