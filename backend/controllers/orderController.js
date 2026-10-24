const db = require("../config/db");


/* =========================================================
   CREATE ORDER
   ========================================================= */

exports.create = async (req, res) => {

    let client = null;

    try {

        /* CONNECT TO DATABASE */

        client = await db.connect();


        /* GET CUSTOMER DATA */

        const {
            name,
            phone,
            city,
            address,
            message,
            items
        } = req.body;


        /* VALIDATE CUSTOMER */

        if (
            !name ||
            !String(name).trim() ||
            !phone ||
            !String(phone).trim() ||
            !address ||
            !String(address).trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Name, phone and address are required"

            });
        }


        /* VALIDATE ITEMS */

        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Order items are required"

            });
        }


        /* START TRANSACTION */

        await client.query("BEGIN");


        const resolvedItems = [];


        /* =====================================================
           FIND PRODUCTS
           ===================================================== */

        for (const item of items) {

            const itemId =
                Number(item.id);

            const itemName =
                String(
                    item.name || ""
                ).trim();

            const qty =
                Number(item.qty);


            /* VALIDATE QUANTITY */

            if (
                !Number.isInteger(qty) ||
                qty <= 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid quantity"

                });
            }


            let productResult = null;


            /* =================================================
               FIND PRODUCT BY ID
               ================================================= */

            if (
                Number.isInteger(itemId) &&
                itemId > 0
            ) {

                productResult =
                    await client.query(
                        `
                        SELECT
                            id,
                            code,
                            name,
                            final_rate,
                            mrp,
                            is_sold_out
                        FROM products
                        WHERE id = $1
                        LIMIT 1
                        `,
                        [itemId]
                    );
            }


            /* =================================================
               FIND PRODUCT BY NAME
               ================================================= */

            if (
                !productResult ||
                productResult.rows.length === 0
            ) {

                if (!itemName) {

                    await client.query(
                        "ROLLBACK"
                    );

                    return res.status(400).json({

                        success: false,

                        message:
                            "Product not found"

                    });
                }


                productResult =
                    await client.query(
                        `
                        SELECT
                            id,
                            code,
                            name,
                            final_rate,
                            mrp,
                            is_sold_out
                        FROM products
                        WHERE LOWER(TRIM(name))
                            =
                            LOWER(TRIM($1))
                        LIMIT 1
                        `,
                        [itemName]
                    );
            }


            /* PRODUCT NOT FOUND */

            if (
                !productResult ||
                productResult.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({

                    success: false,

                    message:
                        "Product not found",

                    productId:
                        itemId,

                    productName:
                        itemName

                });
            }


            const product =
    productResult.rows[0];


if (product.is_sold_out === true) {

    await client.query(
        "ROLLBACK"
    );


    return res.status(400).json({

        success: false,

        message:
            `Product "${product.name}" is sold out`,

        productId:
            Number(product.id),

        productName:
            product.name

    });

}


const price =
    Number(
        product.final_rate || 0
    );


            resolvedItems.push({

                productId:
                    Number(product.id),

                productCode:
                    product.code || "",

                productName:
                    product.name,

                qty,

                price

            });

        }


        /* =====================================================
           CALCULATE TOTAL
           ===================================================== */

        let total = 0;


        for (
            const item of resolvedItems
        ) {

            total +=
                item.price *
                item.qty;

        }


        total =
            Number(
                total.toFixed(2)
            );


        /* =====================================================
           CREATE ORDER NUMBER
           ===================================================== */

        const now =
            new Date();


        const dateParts =
            new Intl.DateTimeFormat(
                "en-GB",
                {
                    timeZone:
                        "Asia/Kolkata",

                    year:
                        "numeric",

                    month:
                        "2-digit",

                    day:
                        "2-digit"
                }
            ).formatToParts(now);


        const year =
            dateParts.find(
                p =>
                    p.type === "year"
            ).value;


        const month =
            dateParts.find(
                p =>
                    p.type === "month"
            ).value;


        const day =
            dateParts.find(
                p =>
                    p.type === "day"
            ).value;


        const orderDate =
            `${year}${month}${day}`;


        const countResult =
            await client.query(
                `
                SELECT COUNT(*) AS count
                FROM orders
                WHERE order_number LIKE $1
                `,
                [
                    `VJS-${orderDate}-%`
                ]
            );


        const orderCount =
            Number(
                countResult.rows[0].count
            ) + 1;


        const orderNumber =
            `VJS-${orderDate}-${String(
                orderCount
            ).padStart(2, "0")}`;


        /* =====================================================
           INSERT ORDER
           ===================================================== */

        const orderResult =
            await client.query(
                `
                INSERT INTO orders
                (
                    order_number,
                    customer_name,
                    phone,
                    city,
                    address,
                    message,
                    total,
                    status,
                    source
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9
                )
                RETURNING
                    id,
                    order_number
                `,
                [

                    orderNumber,

                    String(name).trim(),

                    String(phone).trim(),

                    city
                        ? String(city).trim()
                        : "",

                    String(address).trim(),

                    message
                        ? String(message)
                        : "",

                    total,

                    "NEW",

                    "WHATSAPP"

                ]
            );


        const orderId =
            orderResult.rows[0].id;


        /* =====================================================
           INSERT ORDER ITEMS
           ===================================================== */

        for (
            const item of resolvedItems
        ) {

            await client.query(
                `
                INSERT INTO order_items
                (
                    order_id,
                    product_id,
                    product_code,
                    product_name,
                    qty,
                    unit_price
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6
                )
                `,
                [

                    orderId,

                    item.productId,

                    item.productCode,

                    item.productName,

                    item.qty,

                    item.price

                ]
            );

        }


        /* =====================================================
           COMMIT
           ===================================================== */

        await client.query(
            "COMMIT"
        );


        /* =====================================================
           SUCCESS RESPONSE
           ===================================================== */

        return res.status(201).json({

            success: true,

            message:
                "Order created successfully",

            orderId,

            orderNumber,

            total

        });


    } catch (error) {


        /* =====================================================
           ROLLBACK SAFELY
           ===================================================== */

        if (client) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    "ROLLBACK ERROR:",
                    rollbackError
                );

            }

        }


        console.error(
            "ORDER CREATE ERROR:",
            error
        );


        /* =====================================================
           DATABASE / SERVER ERROR
           ===================================================== */

        return res.status(500).json({

            success: false,

            message:
                "Order creation failed",

            error:
                error.message

        });

    } finally {


        /* =====================================================
           RELEASE CONNECTION
           ===================================================== */

        if (client) {

            client.release();

        }

    }

};


/* =========================================================
   LIST ORDERS
   ========================================================= */

exports.list = async (
    req,
    res
) => {

    try {

        const result =
            await db.query(
                `
                SELECT
                    o.id,
                    o.order_number,
                    o.customer_name,
                    o.phone,
                    o.city,
                    o.address,
                    o.message,
                    o.total,
                    o.status,
                    o.source,
                    o.created_at
                FROM orders o
                ORDER BY
                    o.created_at DESC
                `
            );


        return res.json({

            success: true,

            orders:
                result.rows

        });


    } catch (error) {

        console.error(
            "ORDER LIST ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};


/* =========================================================
   UPDATE ORDER STATUS
   ========================================================= */

exports.updateStatus = async (
    req,
    res
) => {

    try {

        const orderId =
            Number(req.params.id);


        const status =
            String(
                req.body.status || ""
            )
            .trim()
            .toUpperCase();


        if (
            !Number.isInteger(orderId) ||
            orderId <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid order ID"

            });

        }


        const allowedStatuses = [

            "NEW",

            "CONFIRMED",

            "DELIVERED"

        ];


        if (
            !allowedStatuses.includes(
                status
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid order status"

            });

        }


        const result =
            await db.query(
                `
                UPDATE orders
                SET status = $1
                WHERE id = $2
                RETURNING
                    id,
                    order_number,
                    status
                `,
                [
                    status,
                    orderId
                ]
            );


        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Order not found"

            });

        }


        return res.json({

            success: true,

            message:
                "Order status updated",

            order:
                result.rows[0]

        });


    } catch (error) {

        console.error(
            "ORDER STATUS ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

/* =========================================================
   DELETE ORDER
   ========================================================= */

exports.deleteOrder = async (req, res) => {
    const client = await db.connect();

    try {
        const orderId = Number(req.params.id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        await client.query("BEGIN");

        // Check whether this order exists
        const orderResult = await client.query(
            "SELECT id FROM orders WHERE id = $1",
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Delete items belonging to this order only
        await client.query(
            "DELETE FROM order_items WHERE order_id = $1",
            [orderId]
        );

        // Delete the selected order only
        await client.query(
            "DELETE FROM orders WHERE id = $1",
            [orderId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Order deleted successfully"
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("ORDER DELETE ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete order"
        });

    } finally {
        client.release();
    }
};