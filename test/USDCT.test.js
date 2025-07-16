const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("USDCT", function () {
  it("Should mint 1,000,000 tokens to the deployer", async function () {
    const [owner] = await ethers.getSigners();
    const USDCT = await ethers.getContractFactory("USDCT");
    const usdct = await USDCT.deploy();
    await usdct.waitForDeployment();

    const ownerBalance = await usdct.balanceOf(owner.address);
    expect(ownerBalance).to.equal(ethers.parseUnits("1000000", 18));
  });
});
