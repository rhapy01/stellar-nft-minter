//! Stellar NFT Minter — Soroban Smart Contract
//!
//! Deploys to Stellar Testnet.  Anyone can mint; each NFT is identified by
//! an incrementing u32 token_id.  Metadata (name, description, image_url,
//! owner) is stored in persistent ledger storage.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, symbol_short,
};

// ─── Storage key enum ───────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    /// Per-token metadata  (persistent storage)
    NFT(u32),
    /// Incrementing token counter (instance storage)
    Counter,
    /// Contract admin set at initialization (instance storage)
    Owner,
}

// ─── NFT metadata ────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct NFTMetadata {
    pub name: String,
    pub description: String,
    pub image_url: String,
    pub owner: Address,
    pub token_id: u32,
    pub created_at: u64,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct StellarNFTMinter;

// 1 year worth of ledgers at ~5 s/ledger
const ONE_YEAR_LEDGERS: u32 = 17_280 * 365;

#[contractimpl]
impl StellarNFTMinter {
    /// Initialize the contract.  Must be called once by the deployer.
    ///
    /// * `owner` – admin address (the deployer)
    pub fn initialize(env: Env, owner: Address) {
        owner.require_auth();
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Counter, &0u32);
        env.storage()
            .instance()
            .extend_ttl(ONE_YEAR_LEDGERS, ONE_YEAR_LEDGERS);
    }

    /// Mint a new NFT.  On Testnet, any authenticated address may mint.
    ///
    /// Returns the newly assigned token_id (starting from 1).
    pub fn mint(
        env: Env,
        to: Address,
        name: String,
        description: String,
        image_url: String,
    ) -> u32 {
        // Caller must authorise this invocation.
        to.require_auth();

        let counter: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Counter)
            .unwrap_or(0);
        let token_id = counter + 1;

        // Bump the counter in instance storage.
        env.storage()
            .instance()
            .set(&DataKey::Counter, &token_id);
        env.storage()
            .instance()
            .extend_ttl(ONE_YEAR_LEDGERS, ONE_YEAR_LEDGERS);

        // Persist the metadata.
        let metadata = NFTMetadata {
            name,
            description,
            image_url,
            owner: to.clone(),
            token_id,
            created_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::NFT(token_id), &metadata);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::NFT(token_id), ONE_YEAR_LEDGERS, ONE_YEAR_LEDGERS);

        // Emit a contract event so the frontend can pick it up.
        // Topics: ("MINT", "nft")   Data: (to, token_id)
        env.events().publish(
            (symbol_short!("MINT"), symbol_short!("nft")),
            (to, token_id),
        );

        token_id
    }

    /// Retrieve metadata for a given token.  Returns None if the token does
    /// not exist.
    pub fn get_nft(env: Env, token_id: u32) -> Option<NFTMetadata> {
        env.storage()
            .persistent()
            .get(&DataKey::NFT(token_id))
    }

    /// Total number of NFTs minted so far.
    pub fn total_supply(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Counter)
            .unwrap_or(0)
    }

    /// Owner address of a specific token, or None if it does not exist.
    pub fn owner_of(env: Env, token_id: u32) -> Option<Address> {
        let meta: Option<NFTMetadata> = env
            .storage()
            .persistent()
            .get(&DataKey::NFT(token_id));
        meta.map(|m| m.owner)
    }

    /// Returns true when a token with the given id has been minted.
    pub fn exists(env: Env, token_id: u32) -> bool {
        env.storage().persistent().has(&DataKey::NFT(token_id))
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_mint_increments_counter() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, StellarNFTMinter);
        let client = StellarNFTMinterClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        let id1 = client.mint(
            &owner,
            &String::from_str(&env, "NFT One"),
            &String::from_str(&env, "First NFT"),
            &String::from_str(&env, "https://example.com/1.png"),
        );
        assert_eq!(id1, 1);
        assert_eq!(client.total_supply(), 1);

        let id2 = client.mint(
            &owner,
            &String::from_str(&env, "NFT Two"),
            &String::from_str(&env, "Second NFT"),
            &String::from_str(&env, "https://example.com/2.png"),
        );
        assert_eq!(id2, 2);
        assert_eq!(client.total_supply(), 2);
    }

    #[test]
    fn test_get_nft_returns_metadata() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, StellarNFTMinter);
        let client = StellarNFTMinterClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        let token_id = client.mint(
            &owner,
            &String::from_str(&env, "Cosmic Voyager"),
            &String::from_str(&env, "A rare space NFT"),
            &String::from_str(&env, "https://example.com/cosmic.png"),
        );

        let metadata = client.get_nft(&token_id).unwrap();
        assert_eq!(metadata.token_id, token_id);
        assert_eq!(metadata.owner, owner);
    }
}
