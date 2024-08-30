const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const hbs = require('hbs');
const { collection, Sales, procurement } = require('./mongodb');

const app = express();
const templatePath = path.join(__dirname, '../templates');
app.use(express.static(path.join(__dirname, '../public')));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.set('view engine', 'hbs');
app.set('views', templatePath);

app.get('/', (req, res) => {
    res.render('login');
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', async (req, res) => {
    const data = {   
        username: req.body.username,
        password: req.body.password,
    };
    await collection.insertMany([data]);
    res.render('home');
});

app.post('/login', async (req, res) => {
    try {
        console.log('Username:', req.body.username);
        console.log('Password:', req.body.password);

        const check = await collection.findOne({ username: req.body.username });
        console.log('Retrieved User:', check);

        if (check && check.password === req.body.password) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Wrong username or password' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.json({ success: false, message: 'An error occurred' });
    }
});

app.get('/home', (req, res) => {
    res.render('home');
});

app.get('/salesPage', (req, res) => {
    res.render('salesPage');
});

app.post('/salesPage', async (req, res) => {
    const salesData = {
        buyerName: req.body.buyerName,
        salesAgentName: req.body.salesAgentName,
        nationalId: req.body.nationalId,
        dueDate: req.body.dueDate,
        location: req.body.location,
        produceName: req.body.produceName,
        phone: req.body.phone,
        type: req.body.type,
        amountDue: req.body.amountDue,
        tonnage: req.body.tonnage
    };
    Sales.insertMany([salesData]);
    res.send('<script>alert("Data saved successfully!"); window.location.href = "/home";</script>')
});



app.get('/procurementPage', (req, res) => {
    res.render('procurementPage')
})

app.post('/procurementPage', async(req, res) => {
    const procurementData = {
        produceName: req.body.produceName,
        dealerName: req.body.dealerName,
        Type: req.body.Type,
        Cost: req.body.Cost,
        Date: req.body.Date,
        BranchName: req.body.BranchName,
        Time: req.body.Time,
        Tonnage: req.body.Tonnage,
        phone: req.body.phone
    }
    procurement.insertMany([procurementData]);
    res.send('<script>alert("Data saved successfully!"); window.location.href = "/home";</script>')
});

app.get('/managerDashboard', (req, res) => {
    res.render('managerDashboard');
});
app.get('/fetchProcurementData', async (req, res) => {
    try {
        const procurementData = await procurement.find({});
        res.json(procurementData);
    } catch (error) {
        console.error('Error fetching procurement data:', error);
        res.status(500).send('Error fetching procurement data');
    }
});

app.post('/updateProcurementData', async (req, res) => {
    try {
        const { _id, produceName, dealerName, Type, Cost, Date, BranchName, Time, Tonnage, phone } = req.body; // Add phone here
        await procurement.findByIdAndUpdate(_id, {
            produceName,
            dealerName,
            Type,
            Cost,
            Date,
            BranchName,
            Time,
            Tonnage,
            phone // Add this line
        });
        res.send('Data updated successfully');
    } catch (error) {
        console.error('Error updating procurement data:', error);
        res.status(500).send('Error updating procurement data');
    }
});



app.listen(3000, () => {
    console.log('Server started on port 3000');
});
