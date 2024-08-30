const mongoose = require('mongoose')

mongoose.connect('mongodb://localhost:27017/HappyHoeDb')
    .then(() => {
        console.log('mongodb connected')
    })
    .catch(() => {
        console.log('mongodb failed to connect')
    })

const loginSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['manager', 'agent'],
        required: true
    },
    branch: {
        type: String,
        enum: ['Matugga', 'Maganjo'],
        required: true
    }
})

const salesSchema = new mongoose.Schema({
    buyerName: String,
    salesAgentName: String,
    nationalId: String,
    dueDate: Date,
    location: String,
    produceName: String,
    phone: String,
    type: String,
    amountDue: String,
    tonnage: String
});

const procurementSchema = new mongoose.Schema({
    produceName: String,
    dealerName: String,
    Type: String,
    Cost: String,
    Date: Date,
    BranchName: String,
    Time: String,
    Tonnage: String,
    phone: String // Add this line
});


const procurement = mongoose.model("procurement", procurementSchema);

const Sales = mongoose.model('Sales', salesSchema);

const collection = new mongoose.model('Collection', loginSchema)

module.exports = { collection, Sales, procurement };