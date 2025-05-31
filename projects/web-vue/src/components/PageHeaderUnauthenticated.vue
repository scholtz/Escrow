<template>
  <nav class="container mx-auto px-6 py-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <div class="relative w-8 h-8">
          <i class="pi pi-objects-column absolute text-white !text-3xl"></i>
        </div>
        <RouterLink to="/">
          <span class="text-white text-xl font-bold"> Biatec HTLC</span>
        </RouterLink>
      </div>
      <RouterLink to="/dashboard">
        <MainButton class="px-6 py-2"> Connect Wallet </MainButton>
      </RouterLink>
    </div>
  </nav>
</template>
