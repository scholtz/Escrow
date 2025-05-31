<script setup lang="ts">
import PageHeaderUnauthenticated from '../components/PageHeaderUnauthenticated.vue'
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen">
    <PageHeaderUnauthenticated />

    <main class="flex flex-grow-1 container mx-auto px-6 py-16">
      <div class="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 class="text-5xl font-bold text-white mb-6">
            AVM HTLC Solution
          </h1>
          <p class="text-teal-100 text-lg mb-8">
            Utilize ready made HTLC solution for AVM blockchains - Algorand, VOI, or Aramid chain.
          </p>
          <div class="flex space-x-4">
            <RouterLink
              to="/dashboard"
              class="bg-white text-teal-900 px-8 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all flex items-center"
            >
              Create or claim escrow
              <i class="pi pi-arrow-right ml-2 text-lg"></i>
            </RouterLink>
            <RouterLink
              to="/try-it-out"
              class="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:bg-opacity-10 transition-all"
            >
              Live escrows
            </RouterLink>
            <!-- <button
              class="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:bg-opacity-10 transition-all"
            >
              Learn More
            </button> -->
          </div>
        </div>
        <div class="grid grid-cols-2 gap-6">
          <div
            class="bg-teal-900 hover:bg-opacity-90 bg-opacity-50 p-6 rounded-xl backdrop-blur-lg"
          >
            <i class="pi pi-shield !text-4xl text-teal-300 mb-4 text-2xl leading-none"></i>
            <h3 class="text-white font-semibold text-xl mb-2">Secure</h3>
            <p class="text-teal-100">
              Open source solution with full test coverage, deployed to DLT in non upgradable contracts
            </p>
          </div>
          <div
            class="bg-teal-900 hover:bg-opacity-90 bg-opacity-50 p-6 rounded-xl backdrop-blur-lg"
          >
            <i class="pi pi-dollar !text-4xl text-teal-300 mb-4"></i>
            <h3 class="text-white font-semibold text-xl mb-2">Low Cost</h3>
            <p class="text-teal-100">
              To create and claim 1000 HTLC escrow accounts you pay max 6 Algos ~ $1 (redeemable MBR not included)
            </p>
          </div>
          <div
            class="bg-teal-900 hover:bg-opacity-90 bg-opacity-50 p-6 rounded-xl backdrop-blur-lg"
          >
            <i class="pi pi-home !text-4xl text-teal-300 mb-4"></i>
            <h3 class="text-white font-semibold text-xl mb-2">Multi AVM chains support</h3>
            <p class="text-teal-100">
              Biatec HTLC is deployed to Algorand, Voi and Aramid chain
            </p>
          </div>
          <div
            class="bg-teal-900 hover:bg-opacity-90 bg-opacity-50 p-6 rounded-xl backdrop-blur-lg"
          >
            <i class="pi pi-cog !text-4xl text-teal-300 mb-4"></i>
            <h3 class="text-white font-semibold text-xl mb-2">Custom Config</h3>
            <p class="text-teal-100">Any ASAs or native tokens are supported and escrow creator can taker or anyone who knows the secret</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
