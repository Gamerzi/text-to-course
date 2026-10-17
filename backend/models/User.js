import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please provide a name'],
            trim: true,
            minlength: 2,
            maxlength: 50,
        },
        email: {
            type: String,
            required: [true, 'Please provide an email'],
            unique: true,
            lowercase: true,
            trim: true,
            validate: {
                validator: (value) => validator.isEmail(value),
                message: 'Please provide a valid email address',
            },
        },
        password: {
            type: String,
            required: [true, 'Please provide a password'],
            validate: {
                validator: (value) =>
                    validator.isStrongPassword(value, {
                        minLength: 8,
                        minLowercase: 1,
                        minUppercase: 1,
                        minNumbers: 1,
                        minSymbols: 1,
                    }),
                message:
                    'Password must be at least 8 characters long and include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character',
            },
        },
    },
    {
        timestamps: true,
    }
);

// Hash password before saving to DB
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Instance method: Generate JWT token directly from the user document
userSchema.methods.getSignedJwtToken = function () {
    return jwt.sign(
        { id: this._id, name: this.name, email: this.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );
};

// Static method: Register user and return both user and generated token
userSchema.statics.registerUser = async function ({ name, email, password }) {
    if (!validator.isEmail(email)) {
        const error = new Error('Invalid email format');
        error.statusCode = 400;
        throw error;
    }

    const existingUser = await this.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        const error = new Error('User already exists with this email');
        error.statusCode = 400;
        throw error;
    }

    // Create user in DB
    const newUser = await this.create({
        name,
        email,
        password,
    });

    // Generate token directly on the model instance
    const token = newUser.getSignedJwtToken();

    return token;
};


// Instance method: compare entered password with hashed password in DB
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Static method: find user by credentials and return user + token
userSchema.statics.loginUser = async function ({ email, password }) {
    if (!email || !password) {
        const error = new Error('Please provide email and password');
        error.statusCode = 400;
        throw error;
    }

    // Find user by lowercase email
    const user = await this.findOne({ email: email.toLowerCase() });

    if (!user) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
    }

    // Generate JWT token from model instance
    const token = user.getSignedJwtToken();

    return token;
};

const User = mongoose.model('User', userSchema);

export default User;