const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const hbs = require('hbs');
const session = require('express-session');
const { collection, Sales, procurement } = require('./mongodb');

// Add this near the top of your file, after requiring hbs
hbs.registerHelper('eq', function (a, b) {
    return a === b;
});

const app = express();
const templatePath = path.join(__dirname, '../templates');
app.use(express.static(path.join(__dirname, '../public')));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Add session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

app.set('view engine', 'hbs');
app.set('views', templatePath);

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Add this after the isAuthenticated middleware
const isManager = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'manager') {
        next();
    } else {
        res.status(403).send('Access denied. Managers only.');
    }
};

// Make home the landing page
app.get('/', (req, res) => {
    // Fetch current stock data from the database
    // This is a placeholder. Replace with actual database query.
    const currentStock = [
        { name: 'Beans', quantity: '1000 tonnes' },
        { name: 'Rice', quantity: '1000 tonnes' },
        { name: 'Cow peas', quantity: '1000 tonnes' },
        { name: 'Groundnuts', quantity: '1000 tonnes' },
        { name: 'Soybeans', quantity: '1000 tonnes' },
        { name: 'Maize', quantity: '1000 tonnes' }
    ];

    res.render('home', { 
        isLoggedIn: !!req.session.user,
        userName: req.session.user ? req.session.user.username : null,
        userBranch: req.session.user ? req.session.user.branch : null,
        userRole: req.session.user ? req.session.user.role : null,
        currentStock: currentStock
    });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', async (req, res) => {
    const data = {   
        username: req.body.username,
        password: req.body.password,
        branch: req.body.branch,
        role: req.body.role
    };
    await collection.insertMany([data]);
    res.redirect('/');
});

app.post('/login', async (req, res) => {
    try {
        const user = await collection.findOne({ username: req.body.username });
        if (user && user.password === req.body.password) {
            req.session.user = {
                id: user._id,
                username: user.username,
                branch: user.branch,
                role: user.role
            };
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.json({ success: false, message: 'An error occurred' });
    }
});

app.get('/home', isAuthenticated, (req, res) => {
    res.render('home', { 
        isLoggedIn: true, 
        userName: req.session.user.username,
        userBranch: req.session.user.branch,
        userRole: req.session.user.role
    });
});

app.get('/salesPage', isAuthenticated, (req, res) => {
    res.render('salesPage', { user: req.session.user });
});

app.post('/salesPage', isAuthenticated, async (req, res) => {
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

app.get('/procurementPage', isAuthenticated, isManager, (req, res) => {
    res.render('procurementPage', { 
        user: req.session.user,
        isLoggedIn: true
    });
});

app.post('/procurementPage', isAuthenticated, isManager, async (req, res) => {
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

app.get('/managerDashboard', isAuthenticated, (req, res) => {
    res.render('managerDashboard', { user: req.session.user });
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

app.get('/getUserBranch', isAuthenticated, (req, res) => {
    res.json({ success: true, branch: req.session.user.branch });
});

app.post('/signout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to sign out' });
        }
        res.json({ success: true });
    });
});

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
