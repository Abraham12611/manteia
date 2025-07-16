const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Market Contracts", function () {
  let mockMailbox;
  let marketHub;
  let marketSpoke;
  let owner;
  let addr1;
  let addr2;

  const MANTLE_DOMAIN_ID = 5003;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const MockMailbox = await ethers.getContractFactory("MockMailbox");
    mockMailbox = await MockMailbox.deploy();
    await mockMailbox.waitForDeployment();

    const MarketHub = await ethers.getContractFactory("MarketHub");
    marketHub = await MarketHub.deploy(mockMailbox.target);
    await marketHub.waitForDeployment();

    const MarketSpoke = await ethers.getContractFactory("MarketSpoke");
    marketSpoke = await MarketSpoke.deploy(mockMailbox.target, MANTLE_DOMAIN_ID, marketHub.target);
    await marketSpoke.waitForDeployment();
  });

  describe("MarketHub", function () {
    it("Should place an order locally", async function () {
      const marketId = 1;
      const price = 60;
      const amount = 100;
      const isBuy = true;

      await marketHub.connect(addr1).placeOrder(marketId, price, amount, isBuy);

      const order = await marketHub.orders(marketId, addr1.address);
      expect(order.user).to.equal(addr1.address);
      expect(order.price).to.equal(price);
      expect(order.amount).to.equal(amount);
      expect(order.isBuy).to.equal(isBuy);
    });

    it("Should handle a message from MarketSpoke", async function () {
      const marketId = 2;
      const price = 62;
      const amount = 50;
      const isBuy = false;

      new ethers.AbiCoder().encode(
            ["uint256", "uint256", "uint256", "bool"],
            [marketId, price, amount, isBuy]
          )

      // Simulate a message coming from the MarketSpoke
      await marketHub.connect(owner).handleMessage(0, ethers.ZeroHash, message);

      const order = await marketHub.orders(marketId, owner.address);
      expect(order.user).to.equal(owner.address);
      expect(order.price).to.equal(price);
      expect(order.amount).to.equal(amount);
      expect(order.isBuy).to.equal(isBuy);
    });
  });

  describe("MarketSpoke", function () {
    it("Should dispatch an order to MarketHub", async function () {
      const marketId = 3;
      const price = 65;
      const amount = 75;
      const isBuy = true;

      await expect(marketSpoke.connect(addr2).placeOrder(marketId, price, amount, isBuy))
        .to.emit(mockMailbox, "Dispatch")
        .withArgs(
          MANTLE_DOMAIN_ID,
          ethers.zeroPadValue(marketHub.target, 32),
          new ethers.AbiCoder().encode(
            ["uint256", "uint256", "uint256", "bool"],
            [marketId, price, amount, isBuy]
          )
        );
    });
  });
});
