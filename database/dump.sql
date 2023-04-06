\c tokens-data;

-- Create the deposits table
CREATE TABLE deposits (
    id serial PRIMARY KEY,
    hash varchar(66) UNIQUE,
    amount varchar(120),
    token_address varchar(42),
    token_decimals SMALLINT,
    token_symbol varchar(10),
    address varchar(42),
    status varchar(25),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create an index on the address column for faster queries
CREATE INDEX idx_deposits_address ON deposits (address);

-- Create the withdrawals table
CREATE TABLE withdrawals (
    id serial PRIMARY KEY,
    hash varchar(66) UNIQUE,
    l1_hash varchar(66) UNIQUE NULL ,
    amount varchar(120),
    token_address varchar(42),
    token_decimals SMALLINT,
    token_symbol varchar(10),
    address varchar(42),
    status varchar(25),
    recent_status varchar(25) NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create an index on the address column for faster queries
CREATE INDEX idx_withdrawals_address ON withdrawals (address);
