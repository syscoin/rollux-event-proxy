
require('dotenv').config();
const { Sequelize, DataTypes, Op, NOW } = require('sequelize');
const { ethers } = require('ethers')
const { CrossChainMessenger, ETHBridgeAdapter, StandardBridgeAdapter } = require('@eth-optimism/sdk')
const contracts = require('./contracts')

const db = new Sequelize.Sequelize(`postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@db:5432/${process.env.DB_NAME}`, {
    logging: false,
})

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

const messageStatus2Text = [
    "Unconfirmed L1 to L2 message",
    "Failed L1 to L2 message",
    "Waiting for state root",
    "Ready to prove",
    "In challenge period",
    "Ready for relay",
    "Relayed"
]


const l1_provider = new ethers.providers.StaticJsonRpcProvider(process.env.L1_RPC_URL)
const l2_provider = new ethers.providers.StaticJsonRpcProvider(process.env.L2_RPC_URL)
const abiDeposits = [
    "event ETHDepositInitiated(address indexed from,address indexed to,uint256 amount,bytes extraData)",
    "event ERC20DepositInitiated(address indexed l1Token,address indexed l2Token,address indexed from,address to,uint256 amount,bytes extraData)",
];
const abiWithdrawals = [
    "event WithdrawalInitiated(address indexed l1Token,address indexed l2Token,address indexed from,address to,uint256 amount,bytes extraData)"
]
const ifaceERC20 = new ethers.utils.Interface(abiDeposits);
const withdrawInterface = new ethers.utils.Interface(abiWithdrawals);
const erc20 = new ethers.Contract(ethers.constants.AddressZero, new ethers.utils.Interface([
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
]))

const processDeposits = async () => {

    console.log(`${(new Date).toLocaleString()} - fetching data from deposits`)

    _lock = true;

    const deposits_raw = await fetch(
        `${process.env.BLOCKSCOUT_API_URL}v2/optimism/deposits`
    )
    const depositsJSON = await deposits_raw.json();

    const deposits = depositsJSON.items;

    const deposits_finalized = await Promise.all(deposits.map(async (deposit) => {
        const tx = await l1_provider.getTransactionReceipt(deposit.l1_tx_hash);

        const events = tx.logs.map(log => {
            try {
                return ifaceERC20.parseLog(log)
            } catch (e) {
                return null;
            }
        }).filter(item => item !== null);


        if (events.length === 0) {
            return null;
        }

        const deposit_event = events[0] ?? null;

        if (null === deposit_event) return null;

        const isErcDeposit = deposit_event.eventFragment.name === 'ERC20DepositInitiated';

        const result = {
            hash: deposit.l1_tx_hash,
            amount: isErcDeposit ? deposit_event.args[4].toHexString() : deposit_event.args[2].toHexString(),
            token_address: isErcDeposit ? deposit_event.args[0] : ethers.constants.AddressZero,
            token_decimals: isErcDeposit ? await erc20.connect(l1_provider).attach(deposit_event.args[0]).decimals() : 18,
            token_symbol: isErcDeposit ? await erc20.connect(l1_provider).attach(deposit_event.args[0]).symbol() : 'SYS',
            address: isErcDeposit ? deposit_event.args[2] : deposit_event.args[0],
            status: 'Relayed',
        }

        return result;
    }))

    console.log(`Collected deposits - ${deposits_finalized.length}`)
    console.log(`Running upsert...`)

    try {
        await Promise.all(deposits_finalized.map(async (item) => {
            return await depositsModel.upsert(item);
        }))


        console.log(`Upsert done`);

    } catch (error) {
        console.log(`Upsert failed with error -${error}`)
    }
}

const processWithdrawals = async () => {

    console.log(`${(new Date).toLocaleString()} - fetching data from withdrawals`)

    _lock = true;

    const withdrawals_raw = await fetch(
        `${process.env.BLOCKSCOUT_API_URL}v2/optimism/withdrawals`
    )
    const withdrawalsJSON = await withdrawals_raw.json();

    // const withdrawals = [{ l2_tx_hash: '0xb2565585dff2a1428803cc95717f98d1b2c3f9963ff8d5d8a611cea84dcf4ed8', l1_tx_hash: null }]
    const withdrawals = withdrawalsJSON.items;


    const withdrawals_finalized = await Promise.all(withdrawals.map(async (withdrawal) => {
        const tx = await l2_provider.getTransactionReceipt(withdrawal.l2_tx_hash);

        const events = tx.logs.map(log => {
            try {
                return withdrawInterface.parseLog(log)
            } catch (e) {
                return null;
            }
        }).filter(item => item !== null);


        if (events.length === 0) {
            return null;
        }

        const withdrawalEvent = events[0];

        if (null === events[0]) return null;



        const isErcWithdraw = withdrawalEvent.args[0] !== ethers.constants.AddressZero;

        const result = {
            hash: withdrawal.l2_tx_hash,
            l1_hash: withdrawal.l1_tx_hash ?? '',
            amount: withdrawalEvent.args[4].toHexString(),
            token_address: withdrawalEvent.args[1],
            token_decimals: isErcWithdraw ? await erc20.attach(withdrawalEvent.args[1]).connect(l2_provider).decimals() : 18,
            token_symbol: isErcWithdraw ? await erc20.attach(withdrawalEvent.args[1]).connect(l2_provider).symbol() : 'SYS',
            address: withdrawalEvent.args[2],
            status: withdrawal.status,
        };

        return result;
    }))

    console.log(`Collected withdrawals - ${withdrawals_finalized.length}`)
    console.log(`Running upsert...`)

    try {
        await Promise.all(withdrawals_finalized.map(async (item) => {
            return await withdrawalsModel.upsert(item);
        }))

        console.log(`Upsert done`);

    } catch (error) {
        console.log(`Upsert withdrawals failed with error -${error}`)
    }
}

const watchWithdrawals = async () => {

    const cm = new CrossChainMessenger({
        l1SignerOrProvider: l1_provider,
        l2SignerOrProvider: l2_provider,
        l1ChainId: parseInt(process.env.L1_CHAIN_ID),
        l2ChainId: parseInt(process.env.L2_CHAIN_ID),
        bedrock: true,
        contracts: {
            l1: contracts[process.env.L1_CHAIN_ID],
            l2: contracts[process.env.L2_CHAIN_ID]
        },
        bridges: {
            ETH: {
                Adapter: ETHBridgeAdapter,
                l1Bridge: contracts[process.env.L1_CHAIN_ID].L1StandardBridge,
                l2Bridge: contracts[process.env.L2_CHAIN_ID].L2StandardBridge,
            },
            Standard: {
                Adapter: StandardBridgeAdapter,
                l1Bridge:
                    contracts[process.env.L1_CHAIN_ID].L1StandardBridge,
                l2Bridge: contracts[process.env.L2_CHAIN_ID].L2StandardBridge,
            }
        }
    });

    const items = await withdrawalsModel.findAll({
        where: {
            [Op.or]: {
                status: {
                    [Op.not]: 'Relayed'
                },
                recent_status: {
                    [Op.not]: 'Relayed'
                }
            }
        }
    })

    console.log(`Total items for check status - ${items.length}`)

    await Promise.all(items.map(async (item) => {
        item.update({
            recent_status: messageStatus2Text[await cm.getMessageStatus(item.hash)],
            updated_at: Sequelize.literal('NOW()')
        })
    }))
}

async function main() {
    await db.authenticate();

    let _lock = false;

    let interval = setInterval(async () => {
        if (_lock) return;

        try {

            _lock = true;

            if (process.env.DATA_COLLECTOR_ENABLE_DEPOSITS) {
                await processDeposits();
            }

            if (process.env.DATA_COLLECTOR_ENABLE_WITHDRAWALS) {
                await processWithdrawals();
            }

            if (process.env.DATA_COLLECTOR_ENABLE_WATHCHER) {
                await watchWithdrawals();
            }

            setTimeout(() => {
                _lock = false;
            }, process.env.DATA_COLLECTOR_BEFORE_UNLOCK_TIMEOUT);

        } catch (e) {
            console.error(e)
            clearInterval(interval)
        }
    }, process.env.DATA_COLLECTOR_INITIAL_CHECK_TIMEOUT);


}

main().then(res => {
    console.log(res)
}).catch(error => {
    console.error(error)
}) 