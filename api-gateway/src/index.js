require('dotenv').config();
const express = require('express')
const { Sequelize, DataTypes, Op, NOW } = require('sequelize');
const cors = require('cors')
const app = express()

app.use(cors())

const db = new Sequelize.Sequelize(`postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@db:5432/${process.env.DB_NAME}`, {
    logging: false,
})

const paginate = ({ page, pageSize }) => {
    const offset = page * pageSize;
    const limit = pageSize;

    return {
        offset,
        limit,
    };
};

const depositsModel = db.define('Deposit', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    hash: {
        type: DataTypes.STRING(66),
        unique: true,
        allowNull: false,
    },
    amount: {
        type: DataTypes.STRING(120),
        allowNull: false,
    },
    token_address: {
        type: DataTypes.STRING(25),
        allowNull: false,
    },
    token_decimals: {
        type: DataTypes.SMALLINT,
        allowNull: false,
    },
    token_symbol: {
        type: DataTypes.STRING(10),
        allowNull: false,
    },
    address: {
        type: DataTypes.STRING(42),
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING(25),
        allowNull: false,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
    },
}, {
    timestamps: false,
    tableName: 'deposits',
});

const withdrawalsModel = db.define('Withdrawal', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    hash: {
        type: DataTypes.STRING(66),
        unique: true,
        allowNull: false,
    },
    hash: {
        type: DataTypes.STRING(66),
        unique: true,
        allowNull: false,
    },
    amount: {
        type: DataTypes.STRING(120),
        allowNull: false,
    },
    token_address: {
        type: DataTypes.STRING(25),
        allowNull: false,
    },
    token_decimals: {
        type: DataTypes.SMALLINT,
        allowNull: false,
    },
    token_symbol: {
        type: DataTypes.STRING(10),
        allowNull: false,
    },
    address: {
        type: DataTypes.STRING(42),
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING(25),
        allowNull: false,
    },
    recent_status: {
        type: DataTypes.STRING(25),
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
    },
}, {
    timestamps: false,
    tableName: 'withdrawals',
});



app.get('/deposits/:address', async (req, res, next) => {
    const page = (req.query.page || 1) - 1;
    const pageSize = req.query.limit || 10;
    const address = req.params.address || null;


    const { rows, count } = await depositsModel.findAndCountAll(
        {
            where: {
                address: address
            },
            ...paginate({ page, pageSize })
        }
    )

    res.json({
        items: rows,
        totalItems: count,
    })
})

app.get('/withdrawals/:address', async (req, res, next) => {
    const page = (req.query.page || 1) - 1;
    const pageSize = req.query.limit || 10;
    const address = req.params.address || null;


    const { rows, count } = await withdrawalsModel.findAndCountAll(
        {
            where: {
                address: address
            },
            ...paginate({ page, pageSize })
        }
    )

    res.json({
        items: rows,
        totalItems: count,
    })
})

app.get('/withdrawals/:address/unfinished', async (req, res) => {
    const page = (req.query.page || 1) - 1;
    const pageSize = req.query.limit || 10;
    const address = req.params.address || null;


    const { rows, count } = await withdrawalsModel.findAndCountAll(
        {
            where: {
                address: address,
                recent_status: {
                    [Op.not]: 'Relayed'
                }
            },
            ...paginate({ page, pageSize }),
            logging: console.log
        }
    )

    res.json({
        items: rows,
        totalItems: count,
    })
})

app.listen(8080, "0.0.0.0", function () {
    console.log('API gateway started at 0.0.0.0:8080')
})