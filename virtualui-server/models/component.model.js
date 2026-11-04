import { Schema, model } from "mongoose";

const componentSchema = new Schema({
    name : {
        type : String,
        required: true,
    },
    // Component ka source code. Schema me nahi hoga to mongoose (strict mode) isse chupchap drop kar deta hai
    code: {
        type : String,
        required: true,
    },
    props: {
        type : [String]
    },
    owner : {
        type : Schema.Types.ObjectId,
        ref : 'User',
        required: true
    },
    visibility : {
        type : String,
        enum : ["private", "public"],
        default : "private"
    },
    npmPackage: String
}, {
    timestamps : true,
    versionKey: false
});


// Ek owner ke paas same naam ke do components nahi. Controller ka check race condition me fail ho sakta hai,
// DB level unique index hi asli guarantee hai.
componentSchema.index({ owner: 1, name: 1 }, { unique: true });

const Component = model('Component', componentSchema);
export default Component;



