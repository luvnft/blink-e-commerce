import {
  ActionError,
  ActionPostRequest,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
} from "@solana/actions";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { v4 as uuidv4 } from "uuid";
import { getConnection } from "@/lib/constants";
import { trimUuidToHalf } from "@/lib/helpers";
import prisma from "prisma/db";
import { program } from "anchor/setup";

export const OPTIONS = () => {
  return Response.json(null, { headers: ACTIONS_CORS_HEADERS });
};

export const POST = async (
  req: Request,
  { params }: { params: { username: string; productid: string } }
) => {
  try {
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    const name = searchParams.get("name");
    const email = searchParams.get("email");
    const address = searchParams.get("address");
    const zipcode = searchParams.get("zipcode");
    const city = searchParams.get("city");
    const amount = searchParams.get("amount");
    const state = searchParams.get("state");

    // Validate required fields
    if (!name || !email || !address || !zipcode || !city || !amount || !state) {
      return Response.json(
        { message: "Incomplete data" } as ActionError,
        { headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Fetch product from database
    const product = await prisma.product.findUnique({
      where: { id: params.productid },
      include: { seller: true },
    });

    if (!product) {
      return Response.json(
        { message: "Product not available" } as ActionError,
        { headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Parse request body
    const body: ActionPostRequest = await req.json();
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      return Response.json(
        { message: 'Invalid "account" provided' } as ActionError,
        { headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Create transaction
    const connection = getConnection();
    const transaction = new Transaction();
    const orderUuid = uuidv4();
    const message = trimUuidToHalf(orderUuid);

    let anchorInstruction: anchor.web3.TransactionInstruction | undefined;
    try {
      const orderPda = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), account.toBuffer(), Buffer.from(message)],
        program.programId
      )[0];

      const orderVault = PublicKey.findProgramAddressSync(
        [Buffer.from("orderVault"), orderPda.toBuffer()],
        program.programId
      )[0];

      anchorInstruction = await program.methods
        .createOrder(message, new anchor.BN(Number(product.price) * LAMPORTS_PER_SOL))
        .accountsPartial({
          seller: new PublicKey(product.seller.walletAddress),
          user: account,
          order: orderPda,
          orderVault,
        })
        .instruction();
    } catch (error) {
      console.error("Error creating anchor instruction:", error);
      return Response.json(
        { message: "Error creating order" } as ActionError,
        { headers: ACTIONS_CORS_HEADERS }
      );
    }

    if (!anchorInstruction) {
      return Response.json(
        { message: "Failed to create transaction instruction" } as ActionError,
        { headers: ACTIONS_CORS_HEADERS }
      );
    }

    transaction.add(anchorInstruction);
    transaction.feePayer = account;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const successUrl = `/api/actions/purchasedone?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&address=${encodeURIComponent(address)}&zipcode=${encodeURIComponent(zipcode)}&city=${encodeURIComponent(city)}&amount=${encodeURIComponent(amount)}&state=${encodeURIComponent(state)}&productid=${encodeURIComponent(params.productid)}&uuid=${orderUuid}`;

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        links: {
          next: { type: "post", href: successUrl },
        },
      },
    });

    return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
  } catch (error) {
    console.error("Error processing purchase:", error);
    return Response.json(
      { message: "Error processing request" } as ActionError,
      { headers: ACTIONS_CORS_HEADERS }
    );
  }
};
