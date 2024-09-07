const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const hbs = require('hbs');
const session = require('express-session');
const { collection, Sales, procurement, Product, CreditSale } = require('./mongodb');

hbs.registerHelper('eq', function (a, b) {
    return a === b;
});

// Remove this helper function if it's not used elsewhere
// hbs.registerHelper('lt', function (a, b) {
//     return a < b;
// });

const app = express();
const templatePath = path.join(__dirname, '../templates');
app.use(express.static(path.join(__dirname, '../public')));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.set('view engine', 'hbs');
app.set('views', templatePath);

const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

const isManager = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'manager') {
        next();
    } else {
        res.status(403).send('Access denied. Managers only.');
    }
};

app.get('/', async (req, res) => {
    try {
        const productData = await Product.find({});
        const viewData = {
            isLoggedIn: !!req.session.user,
            productData: productData
        };

        if (req.session.user) {
            viewData.userName = req.session.user.username;
            viewData.userBranch = req.session.user.branch;
            viewData.userRole = req.session.user.role;
        }

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
    console.log('Raw request body:', req.body);
    try {
        console.log('Received sale data:', req.body);
        
        const { 
            produceName, tonnage, buyerName, salesAgentName, saleType, saleDate,
            amountPaid, amountDue, contacts, dateOfDispatch, dueDate, location, nationalId
        } = req.body;
        
        // Check if product exists and has sufficient tonnage
        const product = await Product.findOne({ name: produceName });
        if (!product || product.tonnage < parseFloat(tonnage)) {
            return res.status(400).json({ success: false, message: 'Invalid product or insufficient tonnage' });
        }

        // Update product tonnage
        product.tonnage -= parseFloat(tonnage);
        await product.save();

        // Prepare sale data
        const saleData = {
            buyerName,
            salesAgentName,
            saleDate,
            saleType,
            produceName,
            tonnage: parseFloat(tonnage)
        };

        if (saleType === 'cash') {
            if (parseFloat(amountPaid) < 10000) {
                return res.status(400).json({ success: false, message: 'Amount paid must be at least 10,000 UGX' });
            }
            saleData.amountPaid = parseFloat(amountPaid);
        } else {
            saleData.amountDue = parseFloat(amountDue);
            saleData.contacts = contacts;
            saleData.dateOfDispatch = dateOfDispatch;
            saleData.dueDate = dueDate;
            saleData.location = location;
            saleData.nationalId = nationalId;
        }

        // Save the sale
        const newSale = new Sales(saleData);
        await newSale.save();
        
        res.json({ success: true, message: 'Sale saved successfully', sale: newSale });
    } catch (error) {
        console.error('Error saving sale:', error);
        res.status(400).json({ success: false, message: error.message });
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
        
        let product = await Product.findOne({ name: produceName });
        if (!product) {
            product = new Product({ name: produceName, tonnage: 0 });
        }
        
        product.tonnage += parseFloat(Tonnage);
        await product.save();

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

app.get('/viewSales', isAuthenticated, (req, res) => {
    res.render('viewSales', { user: req.session.user });
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
        
        const existingProcurement = await procurement.findById(_id);
        
        const tonnageDifference = parseFloat(Tonnage) - parseFloat(existingProcurement.Tonnage);
        await Product.findOneAndUpdate(
            { name: produceName },
            { $inc: { tonnage: tonnageDifference } }
        );

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

app.get('/fetchProductData', async (req, res) => {
    try {
        const productData = await Product.find({});
        res.json(productData);
    } catch (error) {
        console.error('Error fetching product data:', error);
        res.status(500).send('Error fetching product data');
    }
});

app.get('/fetchCreditSales', async (req, res) => {
    try {
        const creditSales = await CreditSale.find({});
        res.json(creditSales);
    } catch (error) {
        console.error('Error fetching credit sales:', error);
        res.status(500).send('Error fetching credit sales');
    }
});

app.get('/fetchAllSales', async (req, res) => {
    try {
        const sales = await Sales.find({});
        res.json(sales);
    } catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).send('Error fetching sales');
    }
});

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

app.listen(3000, async () => {
    console.log('Server started on port 3000');
    await createInitialProducts();
});

