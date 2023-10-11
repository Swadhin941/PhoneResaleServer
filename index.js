require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");

const jwt = require('jsonwebtoken');

const SSLCommerzPayment = require('sslcommerz-lts');
const nodemailer = require('nodemailer');
// const mg = require('nodemailer-mailgun-transport');
const store_id = process.env.store_id;
const store_password = process.env.store_password;
const is_live = false;

//Middle wares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.acejzkz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorize Access" });
    };
    const token = authHeader.split(' ')[1];
    // console.log(token);
    jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {
        if (error) {
            return res.status(401).send({ message: "Unauthorize Access" });
        }
        req.decoded = decoded;
        next();
    })
}

async function mailReady(order) {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            // TODO: replace `user` and `pass` values from <https://forwardemail.net>
            user: process.env.smtp_username,
            pass: process.env.smtp_password,
        },
    });
    const info = await transporter.sendMail({
        from: "swadhinghose@gmail.com",
        to: order.email,
        subject: "Purchase Details",
        text: "Payment Successfull",
        html: `
        <div style="background-color:#DBDBDB">
            <div style="padding: 10px 6px;">
                <h1 style="font-weight:bold;margin-top:0px;margin-bottom:0px;">TrxID: ${order.transactionId}</h1>
                <h6 style="margin-top:0px;margin-bottom:0px;">Name : ${order.Name}</h6>
                <h6 style="margin-top:0px;margin-bottom:0px;">Total Cost : ${order.totalCost} Tk</h6>
                <h6 style="margin-top:0px;margin-bottom:0px;">Time : ${order.currentTime}</h6>
                <h6 style="margin-top:0px;margin-bottom:0px;">Date : ${order.currentDate}</h6>
                <h6 style="margin-top:0px;margin-bottom:0px;">City : ${order.city}</h6>
                <h6 style="margin-top:0px;margin-bottom:0px;">Borough : ${order.borough}</h6>
                <h6 style="margin-top:0px;margin-bottom:0px;">Area : ${order.area}</h6>
                <h6 style="margin-top:0px;margin-bottom:0px;">Your Contact : ${order.contact}</h6>
            </div>
        </div>
        `
    })

    if (info.messageId) {
        return;
    }
}

async function run() {
    const Products = client.db('e-buy').collection('Products');
    const categories = client.db('e-buy').collection('categories');
    const phoneModels = client.db('e-buy').collection('phoneModels');
    const Carts = client.db('e-buy').collection('cart');
    const User = client.db('e-buy').collection("users");
    const Wishlist = client.db('e-buy').collection('WishList');
    const Orders = client.db('e-buy').collection("Orders");
    try {
        const verifySeller = async (req, res, next) => {
            const email = req.decoded.email;
            const result = await User.find({ email: email }).project({ role: 1 }).toArray();
            if (result[0].role !== 'seller') {
                return res.status(401).send({ message: "Unauthorize Access" });
            }
            next();
        }

        //Seller Check
        app.get('/sellerCheck/:email', async (req, res) => {
            const email = req.params.email;
            const result = await User.find({ email: email }).project({ role: 1 }).toArray();
            res.send({ isSeller: result[0].role === 'seller' });
        })

        app.get('/allCategories', async (req, res) => {
            const quantity = req.query.quantity;
            if (parseInt(quantity) === 6) {
                const result = await categories.find({}).limit(parseInt(quantity)).toArray();
                return res.send(result);
            }
            else {
                const result = await categories.find({}).toArray();
                return res.send(result);
            }
        });
        app.get("/", async (req, res) => {
            res.send("Server is running");
        })
        // app.get('/postSomething', async (req, res) => {
        //     const phoneData = [
        //         {
        //             Brand: "Asus",
        //             Model: "ROG 3"
        //         },
        //         {
        //             Brand: "Asus",
        //             Model: "ROG II"
        //         },
        //         {
        //             Brand: "Asus",
        //             Model: "Zenfone"
        //         },
        //         {
        //             Brand: "Asus",
        //             Model: "ROG 5"
        //         },
        //         {
        //             Brand: "Asus",
        //             Model: "Zenfone 5Z"
        //         },
        //         {
        //             Brand: "Asus",
        //             Model: "Zenfone 3 max"
        //         },
        //         {
        //             Brand: "Asus",
        //             Model: "Zenfone max (M2)"
        //         },
        //         {
        //             Brand: "Asus",
        //             Model: "Zenfone 8"
        //         },
        //         {
        //             Brand: "Asus",
        //             Model: "Zenfone 6"
        //         },

        //     ]
        //     const result = await phoneModels.insertMany(phoneData);
        //     // const result = await phoneModels.find({}).toArray();
        //     res.send(result);
        // });

        //User post or add new user to database

        app.post('/user', async (req, res) => {
            const { email, fullName, role } = req.body;
            const findOut = await User.find({ email: email }).toArray();
            if (findOut.length >= 1) {
                return res.send({ acknowledged: true });
            }
            else {
                const userPost = await User.insertOne({ email: email, fullName: fullName, role: role });
                return res.send(userPost);
            }
        });

        app.put('/user', verifyJWT, async (req, res) => {
            const email = req.query.user;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            };
            const filter = { email: req.decoded.email };
            const updatedDoc = {
                $set: {
                    profileIMG: req.body.profileURL
                }
            };
            const option = { upsert: true };
            const result = await User.updateOne(filter, updatedDoc, option);
            res.send(result);
        })

        app.get('/emailStatus', async (req, res) => {
            const user = req.query.user;
            const result = await User.findOne({ email: user });

            if (result !== null) {
                if (!result?.emailStatus) {
                    const filter = { email: user };
                    const updateDoc = {
                        $set: {
                            fullName: result.fullName,
                            email: result.email,
                            role: result.role,
                            emailStatus: true
                        }
                    };
                    const option = { upsert: true };
                    const updateResult = await User.updateOne(filter, updateDoc, option);
                }
            }

            res.send({ emailStatus: result?.emailStatus });
        });

        //Jwt Token from here
        app.get('/jwt', async (req, res) => {
            const email = req.query.user;
            const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "1h" });
            // console.log(token);
            res.send({ token: token });
        });
        //Brand Name
        app.get('/brandName', verifyJWT, verifySeller, async (req, res) => {
            const email = req.query.user;
            // console.log(email, req.decoded);
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            else {
                const result = await categories.find({}).toArray();
                return res.status(201).send(result);
            }
        });

        app.post('/productPost', verifyJWT, verifySeller, async (req, res) => {
            const data = req.body;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const result = await Products.insertOne(data);
            res.send(result);
        });

        app.get('/modelName/:brand', verifyJWT, verifySeller, async (req, res) => {
            const brandName = req.params.brand;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const result = await phoneModels.find({ Brand: brandName }).toArray();
            res.send(result);
        });

        app.get('/selected-category/:brandName', async (req, res) => {
            const searchText = req.query.searchText;
            console.log(1,searchText);
            if (searchText!=="") {
                console.log(searchText);
                const result = await Products.find({ $text: { $search: searchText } }).toArray();
                console.log(result);
                return res.send(result);
            }
            else {
            const brandName = req.params.brandName;
            const skipNumber = parseInt(req.query.pageNum) * 4;
            const result = await Products.find({ brandName: brandName }).skip(skipNumber).limit(4).toArray();
            return res.send(result);
            }




        });

        app.get('/Details/:id', async (req, res) => {
            const id = req.params.id;
            let result = await Products.find({ _id: new ObjectId(id) }).toArray();
            res.send(result);
        });

        app.put('/updateProduct', verifyJWT, verifySeller, async (req, res) => {
            const email = req.query.user;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const filterId = { _id: new ObjectId(req.body._id) };
            const updatedDoc = {
                $set: {
                    price: req.body.price,
                    description: req.body.description
                }
            };
            const option = { upsert: true };
            const result = await Products.updateOne(filterId, updatedDoc, option);
            res.send(result);
        });

        app.delete('/deleteProduct', verifyJWT, verifySeller, async (req, res) => {
            const email = req.query.user;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            if (email !== req.body.email) {
                return res.status(401).send({ message: "Unauthorize Access" });
            }
            const query = ({ _id: new ObjectId(req.body._id) });
            const result = await Products.deleteOne(query);
            res.send(result);
        });

        app.post('/addToCart', verifyJWT, async (req, res) => {
            if (req.query.user !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const query = { $and: [{ wishListedEmail: req.body.cartedPerson }, { productID: req.body.productID }] };
            const deleteCart = await Wishlist.deleteOne(query);
            const cartPost = await Carts.insertOne(req.body);
            res.send(cartPost);
        });

        app.get('/cartCheck', verifyJWT, async (req, res) => {
            if (req.query.user !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const productId = req.query.productId;
            const query = { $and: [{ cartedPerson: req.decoded.email }, { productID: productId }] }
            const result = await Carts.find(query).toArray();
            res.send(result.length === 0 ? { acknowledged: false } : { acknowledged: true });
        });

        app.delete('/removeFromCart', verifyJWT, async (req, res) => {
            if (req.query.user !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const query = { $and: [{ productID: req.body.productID }, { cartedPerson: req.body.cartedPerson }] };
            // const result = await Carts.find(query).toArray();
            const result = await Carts.deleteOne(query)
            res.send(result);
        });

        app.get('/allCart', verifyJWT, async (req, res) => {
            const cartedPerson = req.decoded.email;
            if (req.query.user !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            let result = await Carts.find({ cartedPerson }).toArray();
            const fetchAll = await Products.find({}).project({ Quantity: 1, price: 1 }).toArray();
            result.forEach(async (element) => {
                const data = fetchAll.filter(data => data._id.toString() === element.productID.toString())
                element.Quantity = parseInt(data[0].Quantity);
                element.price = data[0].price;
                if (element.Quantity === 0) {
                    await Carts.deleteOne({ _id: new ObjectId(element._id.toString()) })
                }
                else if (element.Quantity < element.purchasedQuantity) {
                    element.purchasedQuantity = element.purchasedQuantity - Math.abs(element.Quantity - element.purchasedQuantity);
                    await Carts.updateOne({ _id: new ObjectId(element._id.toString()) }, { $set: { purchasedQuantity: element.purchasedQuantity } }, { upsert: true });
                }
            })
            res.send(result);
        });

        app.get('/countAllProduct', async (req, res) => {
            const brandName = req.query.brandName;
            const result = await Products.find({ brandName }).toArray();
            res.send({ count: result.length });
        })

        app.get('/getTotalCost', verifyJWT, async (req, res) => {
            const email = req.decoded.email;

            if (req.query.user !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const allCart = await Carts.find({ cartedPerson: email }).toArray();
            let totalCost = 0;
            allCart.forEach(element => {
                totalCost += (element.price * element.purchasedQuantity);
            })
            res.send({ totalCost: totalCost });

        });

        app.put('/incrDecr', verifyJWT, async (req, res) => {
            if (req.query.user !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            let result = await Carts.findOne({ _id: new ObjectId(req.body.id) });
            // console.log(result);
            result.purchasedQuantity = req.body.purchasedQuantity;
            const filter = { _id: new ObjectId(req.body.id) }
            const updatedDoc = {
                $set: {
                    productID: result.productID,
                    cartedPerson: result.cartedPerson,
                    email: result.email,
                    modelName: result.modelName,
                    imgURL: result.imgURL,
                    price: result.price,
                    purchasedQuantity: req.body.purchasedQuantity
                }
            }
            const option = { upsert: true };
            const finalResult = await Carts.updateOne(filter, updatedDoc, option)
            res.send(finalResult);
        });


        app.get('/wishListCheck/:id', verifyJWT, async (req, res) => {
            if (req.query.user !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const email = req.decoded.email;
            const query = { $and: [{ productID: req.params.id }, { wishListedEmail: email }] };
            const result = await Wishlist.findOne(query);
            res.send({ wishCheck: result ? true : false });

        });

        app.post('/wishList', verifyJWT, async (req, res) => {
            if (req.query.user !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const deleteCartQuery = { $and: [{ productID: req.body.productID }, { cartedPerson: req.body.wishListedEmail }] }
            const deleteCart = await Carts.deleteOne(deleteCartQuery);
            const result = await Wishlist.insertOne(req.body);
            res.send(result);
        });

        app.delete('/wishList', verifyJWT, async (req, res) => {
            if (req.query.user !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const query = { $and: [{ productID: req.body.productID }, { wishListedEmail: req.body.wishListedEmail }] };
            const result = await Wishlist.deleteOne(query);
            res.send(result);
        });

        app.get('/allWish', verifyJWT, async (req, res) => {
            // console.log(req.decoded);

            const email = req.decoded.email;
            if (req.query.user !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const result = await Wishlist.find({ wishListedEmail: email }).toArray();
            res.send(result);
        });

        app.post('/cartPayment', verifyJWT, async (req, res) => {
            // console.log(req.body);
            const transactionId = new ObjectId().toString();
            req.body.transactionId = transactionId;
            const email = req.query.user;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const checkTrxID = await Orders.findOne({ transactionId: transactionId });
            if (checkTrxID?.paid) {
                return res.redirect(`https://phoneresale-d5194.web.app/orders?transactionId=${transactionId}`)
            }
            else {
                const data = {
                    total_amount: req.body.totalCost,
                    currency: 'BDT',
                    tran_id: req.body.transactionId,
                    success_url: `http://localhost:5000//payment/success/${transactionId}`,
                    fail_url: `http://localhost:5000//payment/fail/${transactionId}`,
                    cancel_url: `http://localhost:5000//payment/fail/${transactionId}`,
                    ipn_url: '',
                    shipping_method: 'Courier',
                    product_name: 'Mobile',
                    product_category: 'Electronic',
                    product_profile: 'general',
                    cus_name: req.body.Name,
                    cus_email: req.decoded.email,
                    cus_add1: req.body.area,
                    cus_add2: req.body.borough,
                    cus_city: req.body.city,
                    cus_state: req.body.city,
                    cus_postcode: req.body.postcode,
                    cus_country: 'Bangladesh',
                    cus_phone: req.body.contact,
                    cus_fax: req.body.contact,
                    ship_name: req.body.Name,
                    ship_add1: req.body.area,
                    ship_add2: req.body.borough,
                    ship_city: req.body.city,
                    ship_state: req.body.city,
                    ship_postcode: req.body.postcode,
                    ship_country: 'Bangladesh',
                };
                const sslcz = new SSLCommerzPayment(store_id, store_password, is_live)
                sslcz.init(data).then(apiResponse => {
                    // Redirect the user to payment gateway
                    let GatewayPageURL = apiResponse.GatewayPageURL
                    Orders.insertOne({ ...req.body, paid: false });
                    // res.redirect(GatewayPageURL)
                    return res.send({ url: GatewayPageURL });
                });
            }


        });

        app.post('/payment/fail/:transactionId', async (req, res) => {
            const transactionId = req.params.transactionId;
            const deleteOrder = await Orders.deleteOne({ transactionId });
            if (deleteOrder.deletedCount >= 1) {
                return res.redirect(`http://localhost:3000/payment/fail?trxID=${transactionId}&&loop=${Date.now()}`)
            }
        })

        app.post('/payment/success/:transactionId', async (req, res) => {
            // console.log(req.params.transactionId);
            const checkTrxID = await Orders.findOne({ transactionId: req.params.transactionId });
            if (checkTrxID?.paid) {
                return res.redirect(`http://localhost:3000/orders?transactionId=${req.params.transactionId}`)
            }
            else {
                const date = new Date();
                const localTime = date.toLocaleTimeString();
                const dateString = date.toDateString().split(" ");
                const currentDate = dateString[1] + " " + dateString[2] + " " + dateString[3];
                const updatedDoc = {
                    $set: {
                        paid: true,
                        currentDate: currentDate,
                        currentTime: localTime,
                        currentMiliSec: Date.now()
                    }
                };
                const option = { upsert: true };
                const result = await Orders.updateOne({ transactionId: req.params.transactionId }, updatedDoc, option);
                // console.log(result);
                if (result.modifiedCount >= 1) {
                    const allOrders = await Orders.findOne({ transactionId: req.params.transactionId });
                    // console.log(allOrders.allCart);
                    allOrders.allCart.forEach(async (element) => {
                        const query = { $and: [{ productID: element.productID }, { cartedPerson: allOrders.email }] };
                        const deleteResult = await Carts.deleteOne(query);
                        let specificProduct = await Products.findOne({ _id: new ObjectId(element.productID) });
                        specificProduct.Quantity = (parseInt(specificProduct.Quantity) - parseInt(element.purchasedQuantity)).toString();
                        if (specificProduct.Quantity === '0') {
                            const updatedDoc = {
                                $set: {
                                    Quantity: specificProduct.Quantity,
                                    status: 'sold'
                                }
                            };
                            const option = { upsert: true };
                            await Products.updateOne({ _id: new ObjectId(element.productID) }, updatedDoc, option);
                        }
                        else {
                            const updatedDoc = {
                                $set: {
                                    Quantity: specificProduct.Quantity
                                }
                            };
                            const option = { upsert: true };
                            await Products.updateOne({ _id: new ObjectId(element.productID) }, updatedDoc, option);
                        }

                    })

                    const order = await Orders.findOne({ transactionId: req.params.transactionId });
                    mailReady(order);
                    return res.redirect(`http://localhost:3000/orders?transactionId=${req.params.transactionId}`)
                }
            }


        })


        app.get('/orders', verifyJWT, async (req, res) => {
            if (req.query.user !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            else {
                const email = req.decoded.email;
                const result = await Orders.find({ email: email }).sort({ currentMiliSec: -1 }).toArray();
                return res.send(result);
            }
        })

        //Products Api with buyer details

        app.get('/myProducts', verifyJWT, verifySeller, async (req, res) => {
            const email = req.query.user;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const allProducts = await Products.find({ email }).toArray();
            const allOrders = await Orders.find({}).toArray();
            let customizeData = [];
            allProducts.forEach(element1 => {
                let tempData1 = {
                    modelName: element1.modelName,
                    imgURL: element1.imgURL,
                    Quantity: element1.Quantity,
                    postedDate: element1.date,
                    postedTime: element1.localTime,
                    price: element1.price,
                    productID: element1._id.toString()
                };
                let tempData2 = [];
                allOrders.forEach(element2 => {
                    const findData = element2.allCart.find(data => element1._id.toString() === data.productID);
                    if (findData) {
                        tempData2.push({
                            buyerName: element2.Name,
                            buyerEmail: element2.email,
                            transactionId: element2.transactionId,
                            paymentDate: element2.currentDate,
                            paymentTime: element2.currentTime,
                            area: element2.area,
                            city: element2.city,
                            borough: element2.borough,
                            postcode: element2.postcode,
                            contact: element2.contact,
                            purchasedQuantity: findData.purchasedQuantity
                        })
                    }
                })

                if (tempData2.length !== 0) {
                    tempData1.buyerData = tempData2;
                }
                customizeData.push(tempData1);
            });
            res.send(customizeData);
        });

        // app.get('/mailTrial', async (req, res) => {
        //     mailReady()
        // })

    } finally {
        // await client.close();
    }
}
run().catch(error => {
    console.log(error);
});



app.get('/', (req, res) => {
    res.send("e-commerce app is running");
});

app.listen(port, () => {
    console.log(`listening on port: ${port}`);
})