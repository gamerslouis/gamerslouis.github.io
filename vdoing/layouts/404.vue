<template>
  <div class="theme-container">
    <div class="theme-vdoing-content">
      <img src="/img/404.png" alt="404" />
      <blockquote>{{ getMsg() }}</blockquote>
      <router-link to="/">返回首頁</router-link>
    </div>
  </div>
</template>

<script>
const msgs = [
  `我是誰？我在哪？`,
  `看來我們的鏈接壞掉了...`
]

export default {
  methods: {
    getMsg () {
      return msgs[Math.floor(Math.random() * msgs.length)]
    }
  }
}
</script>

<style lang="stylus" scoped>
.theme-vdoing-content
  margin 3rem auto
  padding 1.5rem
  img
    font-size 6rem
    color $accentColor
</style>
