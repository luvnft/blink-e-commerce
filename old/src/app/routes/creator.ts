bimport express from "express";
import axios from "axios";
import { PublicKey } from "@solana/web3.js";
import {
  ProductInfoSchema,
  ProductTypeSchema,
  ProductTypes,
} from "../models/schemas";
import {
  ActionError,
  ActionGetResponse,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS_MIDDLEWARE,
  CompletedAction,
} from "@solana/actions";
import {
  createProducts,
  relayPaymentTransaction,
} from "../services/solana";
import { z } from "zod";
import {
  activateBarkShop,
  activateProductListing,
  generateBlinkUrl,
  initiateVerification,
  placeProductListing,
  registerBarkShop,
  registerProductListing,
  verifyCode,
} from "../services/api";

const router = express.Router();
// const blinkCorsMiddleware = (
//   req: express.Request,
//   res: express.Response,
//   next: express.NextFunction
// ) => {
//   res.set(ACTIONS_CORS_HEADERS_MIDDLEWARE);
//   if (req.method === "OPTIONS") {
//     return res.status(200).json({
//       body: "OK",
//     });
//   }
//   next();
// };
// router.use(blinkCorsMiddleware);

// Step 1: Choose product type and provide product info (GET)
router.get("/", (req, res, next) => {
  try {
    const responseBody: ActionGetResponse = {
      icon: "https://ucarecdn.com/9416c194-b24e-4780-bf91-f55f4dd8f074/barkblink.png",
      label: "CREATE",
      type: "action",
      title: "BARK Protocol Merch Creator",
      description:
        "Start selling your own branded merch directly on Twitter in just a few clicks using blinks! To get started simply select a product to create below:",
      links: {
        actions: [
          {
            href: `/creator/create-product`,
            label: "CREATE",
            parameters: [
              {
                name: "type",
                label: "Select a product",
                required: true,
                type: "select",
                options: ProductTypes.map(
                  (type: { label: any; value: any }) => ({
                    label: type.label,
                    value: type.value,
                  })
                ),
              },
              {
                name: "imageUri",
                label: "Product Image URL",
                required: true,
                type: "url",
              },
              {
                name: "name",
                label: "Product Name",
                required: true,
                type: "text",
              },
              {
                name: "description",
                label: "Product Description",
                required: true,
                type: "textarea",
              },
              {
                name: "quantity",
                label: "Quantity (1-3)",
                required: true,
                type: "select",
                options: [
                  { label: "1", value: "1" },
                  { label: "2", value: "2" },
                  { label: "3", value: "3" },
                ],
              },
              {
                name: "unitPrice",
                label: "Unit Price (in SOL)",
                required: true,
                type: "number",
              },
              { name: "email", label: "Email", required: true, type: "email" },
            ],
          },
        ],
      },
    };
    res.status(200).json(responseBody);
  } catch (error) {
    console.error("Error in GET /:", error);
    next(error);
  }
});

// Step 2: Create NFTs and initiate verification (POST)
router.post("/create-product", async (req, res, next) => {
  try {
    console.log("Received data:", req.body);
    const publicKey = new PublicKey(req.body.account);

    // Extract the data from the nested structure
    const productData = {
      ...req.body.data,
      account: req.body.account,
    };

    const productInfo = ProductInfoSchema.parse({
      ...productData,
      quantity: parseInt(productData.quantity, 10),
      unitPrice: parseFloat(productData.unitPrice),
    });

    const {
      type,
      account,
      imageUri,
      name,
      description,
      quantity,
      unitPrice,
      email,
    } = productInfo;

    const productType = ProductTypes.find((pt) => pt.value === type);
    if (!productType) {
      return res.status(400).json({ error: "Invalid product type" });
    }

    // Use productType.label when you need the full product type name
    const fullProductTypeName = productType.label;

    const {
      totalCost,
      posTxSignature,
      posCollectionAddress,
      listingTxSignature,
      listingCollectionAddress,
      productTxSigs,
      productAddresses,
    } = await createProducts(productInfo, publicKey, "devnet");

    console.log("Relaying tx");

    const relayTx = await relayPaymentTransaction(
      totalCost,
      publicKey,
      "mainnet"
    );
    console.log("Initiating verification");

    const verificationResponse = await initiateVerification(email);
    console.log("Verification initiation response:", verificationResponse);

    if (verificationResponse.status !== 200) {
      throw Error(
        `Verification failed. Status: ${
          verificationResponse.status
        }, Message: ${JSON.stringify(verificationResponse.data)}`
      );
    }

    const paymentTx = Buffer.from(relayTx.serialize()).toString("base64");
    console.log("Responding with this paymentTx: ", paymentTx);

    const responseBody: ActionPostResponse = {
      transaction: paymentTx,
      message:
        "Products created. Please check your email for the verification code.",
      links: {
        next: {
          type: "inline",
          action: {
            type: "action",
            icon: `https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/horizontalmerchcreatoricon.png`,
            label: "Verify Email",
            title: "Enter Verification Code",
            description: `Please enter the 6-digit code sent to: ${email}`,
            links: {
              actions: [
                {
                  href: `/creator/verify-and-place?pos=${posCollectionAddress}&listing=${listingCollectionAddress}&products=${productAddresses.join(
                    ","
                  )}&price=${unitPrice}&account=${account}&email=${email}`,
                  label: "Verify and Place Product",
                  parameters: [
                    {
                      name: "code",
                      label: "6-digit Verification Code",
                      type: "text",
                      required: true,
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    };
    console.log("Created paymentTx:", paymentTx);
    console.log("Sending response:", responseBody);
    res.status(200).json(responseBody);
  } catch (error) {
    console.error("Error in POST /create-product:", error);
    next(error);
  }
});

// Step 3: Verify email, register, activate, and place product (POST)
router.post("/verify-and-place", async (req, res, next) => {
  try {
    console.log("req.body is: ", req.body);
    const code = req.body.data?.code;
    console.log("Verification code:", code);
    // const { code } = req.body;
    // console.log("req.body is: ", req.body);

    const { pos, listing, products, price, account, email } = req.query;
    console.log("req.query: ", req.query);

    if (
      !code ||
      !email ||
      !pos ||
      !listing ||
      !products ||
      !price ||
      !account
    ) {
      console.error("Missing required parameters in verify-and-place!!!");
      const errorResponse: ActionError = {
        message: "Missing required parameters",
      };
      throw Error("Missing required parameters");
    }

    const verificationResponse = await verifyCode(email as string, code);
    console.log("Code verification response:", verificationResponse);

    if (verificationResponse.status !== 200) {
      console.error("Invalid verification code!");
      throw Error("Invalid verification code");
    }

    const registerPosResponse = await registerBarkShop({
      BarkShopId: pos as string,
      eligiblePlacementType: "digitalreplica",
      eligibleProductCategory: "clothing",
      manager: account as string,
    });
    console.log("registerPosResponse response:", registerPosResponse);
    if (registerPosResponse.status !== 200) {
      console.error(
        "Failed to register BarkShop: ",
        registerPosResponse.data
      );
      throw Error("Failed to register BarkShop");
    }

    const activatePosResponse = await activateBarkShop(pos as string);
    console.log("activatePosResponse response:", activatePosResponse);
    if (activatePosResponse.status !== 200) {
      console.error(
        "Failed to activate BarkShop: ",
        activatePosResponse.data
      );
      throw Error("Failed to activate BarkShop");
    }

    const registerListingResponse = await registerProductListing({
      productListingId: listing as string,
      origin: "BarkShop",
      eligiblePlacementType: "digitalreplica",
      eligibleProductCategory: "clothing",
      manager: account as string,
      price: Number(price),
      orderManager: "BarkShop",
    });
    console.log("registerListingResponse response:", registerListingResponse);

    const activateListingResponse = await activateProductListing(
      listing as string
    );
    console.log("activateListingResponse response:", activateListingResponse);

    const placeProductResponse = await placeProductListing({
      productListingId: listing as string,
      BarkShopId: pos as string,
      price: Number(price),
    });
    console.log("placeProductResponse response:", placeProductResponse);

    const BarkShopId = pos;
    const blinkUrl = await generateBlinkUrl(BarkShopId as string);

    const responseBody: CompletedAction = {
      icon: `https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/horizontalmerchcreatoricon.png`,
      label: "Created!",
      type: "completed",
      title: "BARK Merch Creator",
      description: `Your product is ready for sale! Share this Blink URL to start selling: ${blinkUrl}`,
    };
    res.status(200).json(responseBody);
  } catch (error) {
    console.error("Error in POST /verify-and-place:", error);
    next(error);
  }
});

export default router;