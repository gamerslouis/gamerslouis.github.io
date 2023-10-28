<template>
  <div class="theme-vdoing-content">
    <div class="column-wrapper">
      <img v-if="pageData.imgUrl" :src="$withBase(pageData.imgUrl)" />
      <dl class="column-info">
        <dt class="title">{{ pageData.title }}</dt>
        <dd class="description" v-html="pageData.description"></dd>
      </dl>
    </div>
    <div class="catalogue-wrapper" v-if="isStructuring">
      <div class="catalogue-title">目錄</div>
      <div class="catalogue-content">
        <template v-for="(item, index) in getCatalogueList()">
          <dl v-if="type(item) === 'array'" :key="index" class="inline">
            <dt>
              <router-link :to="item[2]"
                >{{ `${index + 1}. ${item[1]}` }}
                <span class="title-tag" v-if="item[3]">
                  {{ item[3] }}
                </span>
              </router-link>
            </dt>
          </dl>
          <dl v-else-if="type(item) === 'object'" :key="index">
            <!-- 一級目錄 -->
            <dt :id="(anchorText = item.title)">
              <a :href="`#${anchorText}`" class="header-anchor">#</a>
              {{ `${index + 1}. ${item.title}` }}
            </dt>
            <dd>
              <!-- 二級目錄 -->
              <template v-for="(c, i) in item.children">
                <template v-if="type(c) === 'array'">
                  <router-link :to="c[2]" :key="i"
                    >{{ `${index + 1}-${i + 1}. ${c[1]}` }}
                    <span class="title-tag" v-if="c[3]">
                      {{ c[3] }}
                    </span>
                  </router-link>
                </template>
                <!-- 三級目錄 -->
                <div
                  v-else-if="type(c) === 'object'"
                  :key="i"
                  class="sub-cat-wrap"
                >
                  <div :id="(anchorText = c.title)" class="sub-title">
                    <a :href="`#${anchorText}`" class="header-anchor">#</a>
                    {{ `${index + 1}-${i + 1}. ${c.title}` }}
                  </div>
                  <router-link
                    v-for="(cc, ii) in c.children"
                    :to="cc[2]"
                    :key="`${index + 1}-${i + 1}-${ii + 1}`"
                  >
                    {{ `${index + 1}-${i + 1}-${ii + 1}. ${cc[1]}` }}
                    <span class="title-tag" v-if="cc[3]">
                      {{ cc[3] }}
                    </span>
                  </router-link>
                </div>
              </template>
            </dd>
          </dl>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      pageData: null,
      isStructuring: true,
      appointDir: {}
    }
  },
  created() {
    this.getPageData()
    const sidebar = this.$themeConfig.sidebar
    if (!sidebar || sidebar === 'auto') {
      this.isStructuring = false
      console.error("目錄頁數據依賴於結構化的側邊欄數據，請在主題設定中將側邊欄字段設定為'structuring'，否則無法獲取目錄數據。")
    }
  },
  methods: {
    getPageData() {
      const pageComponent = this.$frontmatter.pageComponent
      if (pageComponent && pageComponent.data) {
        this.pageData = {
          ...pageComponent.data,
          title: this.$frontmatter.title
        }
      } else {
        console.error('請在front matter中設定pageComponent和pageComponent.data數據')
      }
    },
    getCatalogueList() {
      const { sidebar } = this.$site.themeConfig
      const { data } = this.$frontmatter.pageComponent
      const key = data.path || data.key
      let keyArray = key.split('/');
      let catalogueList = (sidebar[`/${keyArray[0]}/`]);
      if (keyArray.length > 1) {
        // 刪除第一個元素，並修改原數組
        keyArray.shift();
        catalogueList = this.appointDirDeal(0, keyArray, catalogueList);
      }
      if (!catalogueList) {
        console.error('未獲取到目錄數據，請檢視front matter中設定的path是否正確。')
      }
      return catalogueList
    },
    type(o) { // 數據類型檢查
      return Object.prototype.toString.call(o).match(/\[object (.*?)\]/)[1].toLowerCase()
    },
    /**
     * 指定目錄頁配置處理
     * @param index 目錄數組的下標
     * @param dirKeyArray 目錄名稱數組
     * @param catalogueList 目錄對象列錶
     * @returns {*}
     */
    appointDirDeal(index, dirKeyArray, catalogueList) {
      let dirKey = dirKeyArray[index];
      if (dirKey !== undefined && dirKey.indexOf(".") !== -1) {
        dirKey = dirKey.substring(dirKey.indexOf('.') + 1);
      }
      for (let i = 0; i < catalogueList.length; i++) {
        if (catalogueList[i].title === dirKey) {
          this.appointDir = catalogueList[i];
          if (index < dirKeyArray.length - 1) {
            this.appointDirDeal(index + 1, dirKeyArray, catalogueList[i].children);
          }
        }
      }
      return this.appointDir.children;
    },
  },
  watch: {
    '$route.path'() {
      this.getPageData()
    }
  }
}
</script>

<style scoped lang="stylus" rel="stylesheet/stylus">
.theme-vdoing-content
  margin-bottom $navbarHeight
.title-tag
  // height 1.1rem
  // line-height 1.1rem
  border 1px solid $activeColor
  color $activeColor
  font-size 0.8rem
  padding 0 0.35rem
  border-radius 0.2rem
  margin-left 0rem
  transform translate(0, -0.05rem)
  display inline-block
dl, dd
  margin 0
.column-wrapper
  margin-top 1rem
  display flex
  padding-bottom 2rem
  border-bottom 1px solid var(--borderColor)
  img
    width 80px
    height 80px
    border-radius 2px
    margin-right 1rem
  .column-info
    .title
      font-size 1.6rem
    .description
      color var(--textColor)
      opacity 0.8
      margin 0.5rem 0
.catalogue-wrapper
  .catalogue-title
    font-size 1.45rem
    margin 2rem 0
  .catalogue-content
    dl
      margin-bottom 1.8rem
      &.inline
        display inline-block
        width 50%
        margin-bottom 1rem
        @media (max-width $MQMobileNarrow)
          width 100%
        a
          width 100%
      &:not(.inline)
        dt
          margin-top -($navbarHeight)
          padding-top $navbarHeight
      dt
        font-size 1.1rem
        &:hover .header-anchor
          opacity 1
      dd
        margin-top 0.7rem
        margin-left 1rem
        a:not(.header-anchor)
          margin-bottom 0.5rem
          display inline-block
          width 50%
          &:hover
            color $activeColor
            text-decoration none
          @media (max-width 720px)
            width 100%
      .sub-cat-wrap
        margin 5px 0 8px 0
        font-size 0.95rem
        &> a
          padding-left 1rem
          box-sizing border-box
        .sub-title
          margin-top -($navbarHeight)
          padding-top $navbarHeight
          margin-bottom 6px
          font-size 1rem
        &:hover
          .header-anchor
            opacity 1
</style>
