const mongoose = require('mongoose');

const creditSaleSchema = new mongoose.Schema({
    buyerName: { type: String, required: true },
    salesAgentName: { type: String, required: true },
    saleDate: { type: Date, required: true },
    produceName: { type: String, required: true },
    tonnage: { type: Number, required: true },
    amountDue: { type: Number, required: true },
    contacts: { type: String, required: true },
    dateOfDispatch: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    location: { type: String, required: true },
    nationalId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CreditSale', creditSaleSchema);