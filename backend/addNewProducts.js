require("dotenv").config({ path: "../.env" });

const db = require("./config/db");

const PRODUCTS = [
    // SETOUT
    [170, "silver pencil", 280, 56, "1 Box", "SETOUT"],
    [171, "rocket bomb", 280, 56, "1 Box", "SETOUT"],
    [172, "666 cylinder bomb", 800, 160, "1 Box", "SETOUT"],
    [173, "tri colour (M)", 1360, 272, "1 Box", "SETOUT"],
    [174, '2" Fancy (M)', 495, 99, "1 Box", "SETOUT"],
    [175, '2" Fancy (3pcs) (M)', 1360, 272, "1 Box", "SETOUT"],
    [176, "AK/JAGUAR (30 shot) (M)", 2555, 511, "1 Box", "SETOUT"],
    [177, '3.5" Fancy (M)', 1440, 288, "1 Box", "SETOUT"],
    [178, '4" Fancy (M)', 2100, 420, "1 Box", "SETOUT"],
    [179, "12 shot green (M)", 740, 148, "1 Box", "SETOUT"],
    [180, "Chammak chalo 60 shot (M)", 5230, 1046, "1 Box", "SETOUT"],

    // GIFT BOX
    [181, "16 HONK KONG", 1360, 272, "1 Box", "GIFT BOX"],
    [182, "20 JAPAN", 1840, 368, "1 Box", "GIFT BOX"],
    [183, "25 LONDON", 2280, 456, "1 Box", "GIFT BOX"],
    [184, "30 NEW YORK", 2840, 568, "1 Box", "GIFT BOX"],
    [185, "35 ITALY", 3520, 704, "1 Box", "GIFT BOX"],
    [186, "40 SINGAPORE", 4280, 856, "1 Box", "GIFT BOX"],
    [187, "50 DUBAI", 5640, 1128, "1 Box", "GIFT BOX"],
    [188, "60 PARIS", 7480, 1496, "1 Box", "GIFT BOX"],
    [189, "70 GERMANY", 8560, 1712, "1 Box", "GIFT BOX"]
];

async function addNewProducts() {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        // Create categories if they do not already exist
        const categoryMap = {};

        for (const categoryName of ["SETOUT", "GIFT BOX"]) {
            const result = await client.query(
                `
                INSERT INTO categories (name)
                VALUES ($1)
                ON CONFLICT (name)
                DO UPDATE SET name = EXCLUDED.name
                RETURNING id
                `,
                [categoryName]
            );

            categoryMap[categoryName] = result.rows[0].id;
        }

        let inserted = 0;
        let skipped = 0;

        for (const product of PRODUCTS) {
            const [
                serialNo,
                name,
                mrp,
                finalRate,
                pack,
                categoryName
            ] = product;

            const code =
                "VJS-" +
                String(serialNo).padStart(3, "0");

            // Prevent duplicate products
            const existing = await client.query(
                `
                SELECT id
                FROM products
                WHERE code = $1
                `,
                [code]
            );

            if (existing.rows.length > 0) {
                console.log(
                    `SKIPPED: ${code} already exists`
                );

                skipped++;
                continue;
            }

            await client.query(
                `
                INSERT INTO products
                (
                    code,
                    name,
                    category_id,
                    pack,
                    mrp,
                    discount,
                    final_rate,
                    stock,
                    icon,
                    active
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
                    $9,
                    TRUE
                )
                `,
                [
                    code,
                    name,
                    categoryMap[categoryName],
                    pack,
                    mrp,
                    80,
                    finalRate,
                    0,
                    "🎆"
                ]
            );

            console.log(
                `ADDED: ${code} - ${name}`
            );

            inserted++;
        }

        await client.query("COMMIT");

        console.log("");
        console.log("================================");
        console.log("NEW PRODUCTS ADDED SUCCESSFULLY");
        console.log("================================");
        console.log("Inserted:", inserted);
        console.log("Skipped :", skipped);
        console.log("Total   :", PRODUCTS.length);
        console.log("================================");

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("");
        console.error("PRODUCT ADD FAILED ❌");
        console.error(error);

    } finally {
        client.release();
    }
}

addNewProducts();