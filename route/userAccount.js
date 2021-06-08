import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { account_schema } from '../schema/account-schema';

dotenv.config();

const router = express.Router();
const Account = mongoose.model(`${process.env.ACCOUNT_COLLECTION}`, account_schema);

router.get('/:email', (req, res) => {
    Account.find({ email: req.params.email }, (err, account) => {
        if (err) {
            res.status(404).send(err.message)
        } else {
            res.status(200).send(account[0]);
        }
    })
})
router.get('/allAccount/:searchString', (req, res) => {
    Account.find({ displayName: new RegExp(req.params.searchString, 'i') }, (err, accounts) => {
        if (err) {
            res.status(404).send(err.message);
        } else {
            res.status(200).send(accounts);
        }
    })
})

router.post('/', (req, res) => {

    Account.find({ email: req.body.email }, (err, account) => {
        if (err) {
            res.status(404).send(err.message);
        } else {
            if (account !== []) {
                res.status(200).send('Login Successfully');
            } else {
                const newAccount = new Account(req.body);
                newAccount.save((err, result) => {
                    if (err) {
                        res.status(500).send(err.message);
                    } else {
                        res.status(201).send('Sign Up Successfully', result.insertCount > 0)
                    }
                })
            }
        }
    })
})

router.put('/updateChatList/:email', (req, res) => {
    const email = req.params.email;
    const friendsInfo = req.body;

    Account.updateOne({ email }, { $addToSet: { chatList: friendsInfo } }, (err, data) => {
        if (err) res.status(500).send(err.message);
        else res.status(201).send(data);
    });
})

export default router;