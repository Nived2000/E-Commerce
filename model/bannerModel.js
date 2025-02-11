const mongoose = require('mongoose');


const bannerSchema = new mongoose.Schema({
    bannerId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    image: { type: String, required: false },
    name: {type: String, required: false},
    description: {type: String, required: false}
});

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;
