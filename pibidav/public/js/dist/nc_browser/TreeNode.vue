<template>
  <div class="tree-node" :class="{ opened: node.open }">
    <div class="tree-node-content">
      <span
        class="tree-link"
        @click="handleNodeClick"
        :class="{ active: node.value === selected_node.value }"
        :disabled="node.fetching"
      >
        <div class="flex items-center">
          <div v-html="icon"></div>
          <a class="tree-label">{{ node.label }}</a>
        </div>
      </span>
    </div>
    <ul class="tree-children" v-show="node.open">
      <TreeNode
        v-for="n in node.children"
        :key="n.value"
        :node="n"
        :selected_node="selected_node"
        @node-click="n => $emit('node-click', n)"
        @load-more="n => $emit('load-more', n)"
      />
      <button
        class="btn btn-xs btn-load-more"
        v-if="node.has_more_children"
        @click="$emit('load-more', node)"
        :disabled="node.children_loading"
      >
        {{ node.children_loading ? __("Loading...") : __("Load more") }}
      </button>
    </ul>
  </div>
</template>

<script>
export default {
  name: "TreeNode",
  props: ["node", "selected_node"],
  computed: {
    icon() {
      let icons = {
        open: frappe.utils.icon("folder-open", "md"),
        closed: frappe.utils.icon("folder-normal", "md"),
        leaf: frappe.utils.icon("file", "md")
      };
      if (this.node.is_leaf) return icons.leaf;
      if (this.node.open) return icons.open;
      return icons.closed;
    }
  },
  methods: {
    handleNodeClick() {
      this.$emit('node-click', this.node);
    }
  }
};
</script>

<style>
.btn-load-more {
  margin-left: 1.6rem;
  margin-top: 0.5rem;
}
.tree-link {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 1px 3px;
  cursor: pointer;
}
.tree-link.active {
  background-color: var(--gray-200);
}
.tree-children {
  margin-left: 9px;
  padding-left: 0;
}
.tree-node-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>