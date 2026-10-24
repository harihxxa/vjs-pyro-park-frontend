const router =
    require("express").Router();


const controller =
    require("../controllers/orderController");


const auth =
    require("../middleware/authMiddleware");


/*
    CUSTOMER ORDER
    Website can create order
*/

router.post(
    "/",
    controller.create
);


/*
    ADMIN - VIEW ORDERS
*/

router.get(
    "/",
    auth,
    controller.list
);


/*
    ADMIN - UPDATE ORDER STATUS

    NEW
    CONFIRMED
    DELIVERED
*/

router.patch(
    "/:id/status",
    auth,
    controller.updateStatus
);

// ADMIN - DELETE ORDER
router.delete(
    "/:id",
    auth,
    controller.deleteOrder
);

module.exports = router;