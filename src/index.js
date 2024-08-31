const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const hbs = require('hbs');
const session = require('express-session');
const { collection, Sales, procurement, Product } = require('./mongodb');

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
app.get('/', async (req, res) => {
    try {
        const productData = await Product.find({});
        console.log('Fetched product data:', productData);
        
        const viewData = {
            isLoggedIn: !!req.session.user,
            productData: productData
        };

        if (req.session.user) {
            viewData.userName = req.session.user.username;
            viewData.userBranch = req.session.user.branch;
            viewData.userRole = req.session.user.role;
        }

        console.log('View data:', viewData);  // Add this line

        res.render('home', viewData);
    } catch (error) {
        console.error('Error fetching product data:', error);
        res.status(500).render('error', { message: 'Error loading home page' });
    }
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

app.get('/home', isAuthenticated, async (req, res) => {
    try {
        const productData = await Product.find({});
        res.render('home', { 
            isLoggedIn: true, 
            userName: req.session.user.username,
            userBranch: req.session.user.branch,
            userRole: req.session.user.role,
            productData: productData
        });
    } catch (error) {
        console.error('Error fetching product data:', error);
        res.status(500).render('error', { message: 'Error loading home page' });
    }
});

app.get('/salesPage', isAuthenticated, async (req, res) => {
    try {
        const products = await Product.find({ tonnage: { $gt: 0 } });
        res.render('salesPage', { 
            user: req.session.user,
            products: products
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Error loading sales page');
    }
});

app.post('/salesPage', isAuthenticated, async (req, res) => {
    try {
        const { produceName, tonnage, buyerName, salesAgentName, nationalId, dueDate, phone, type, amountDue } = req.body;
        
        // Check if product exists and has enough tonnage
        const product = await Product.findOne({ name: produceName });
        if (!product || product.tonnage < parseFloat(tonnage)) {
            return res.status(400).send('<script>alert("Invalid product or insufficient tonnage"); window.location.href = "/salesPage";</script>');
        }

        // Update product tonnage
        product.tonnage -= parseFloat(tonnage);
        await product.save();

        // Create sales record
        const salesData = {
            buyerName,
            salesAgentName,
            nationalId,
            dueDate,
            produceName,
            phone,
            type,
            amountDue,
            tonnage: parseFloat(tonnage)
        };
        await Sales.create(salesData);

        console.log('Sale recorded:', salesData);
        console.log('Updated product tonnage:', product);

        res.send('<script>alert("Sale recorded successfully!"); window.location.href = "/salesPage";</script>');
    } catch (error) {
        console.error('Error saving sales data:', error);
        res.status(500).send('<script>alert("Error saving sales data"); window.location.href = "/salesPage";</script>');
    }
});

app.get('/procurementPage', isAuthenticated, isManager, (req, res) => {
    res.render('procurementPage', { 
        user: req.session.user,
        isLoggedIn: true
    });
});

app.post('/procurementPage', isAuthenticated, isManager, async (req, res) => {
    try {
        const { produceName, dealerName, Type, Cost, Date, BranchName, Time, Tonnage, phone } = req.body;
        
        console.log('Received procurement data:', { produceName, Tonnage });

        // Find or create the product
        let product = await Product.findOne({ name: produceName });
        if (!product) {
            product = new Product({ name: produceName, tonnage: 0 });
            console.log('Created new product:', product);
        } else {
            console.log('Found existing product:', product);
        }
        
        // Update the product's tonnage
        product.tonnage += parseFloat(Tonnage);
        await product.save();
        console.log('Updated product:', product);

        // Create the procurement record
        const procurementData = {
            produceName,
            dealerName,
            Type,
            Cost,
            Date,
            BranchName,
            Time,
            Tonnage,
            phone
        };
        await procurement.insertMany([procurementData]);

        res.send('<script>alert("Data saved successfully!"); window.location.href = "/home";</script>');
    } catch (error) {
        console.error('Error saving procurement data:', error);
        res.status(500).send('Error saving procurement data');
    }
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
        const { _id, produceName, dealerName, Type, Cost, Date, BranchName, Time, Tonnage, phone } = req.body;
        
        // Find the existing procurement
        const existingProcurement = await procurement.findById(_id);
        
        // Update the product's tonnage
        const tonnageDifference = parseFloat(Tonnage) - parseFloat(existingProcurement.Tonnage);
        await Product.findOneAndUpdate(
            { name: produceName },
            { $inc: { tonnage: tonnageDifference } }
        );

        // Update the procurement record
        await procurement.findByIdAndUpdate(_id, {
            produceName,
            dealerName,
            Type,
            Cost,
            Date,
            BranchName,
            Time,
            Tonnage,
            phone
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

// Add this function to create initial products if none exist
async function createInitialProducts() {
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
        const initialProducts = [
            { name: 'Beans', tonnage: 1000 },
            { name: 'Rice', tonnage: 1000 },
            { name: 'Cow peas', tonnage: 1000 },
            { name: 'Groundnuts', tonnage: 1000 },
            { name: 'Soybeans', tonnage: 1000 },
            { name: 'Maize', tonnage: 1000 }
        ];
        await Product.insertMany(initialProducts);
        console.log('Initial products created');
    }
}

// Call this function when your server starts
app.listen(3000, async () => {
    console.log('Server started on port 3000');
    await createInitialProducts();
});

app.get('/fetchProductData', async (req, res) => {
    try {
        const productData = await Product.find({});
        res.json(productData);
    } catch (error) {
        console.error('Error fetching product data:', error);
        res.status(500).send('Error fetching product data');
    }
});
