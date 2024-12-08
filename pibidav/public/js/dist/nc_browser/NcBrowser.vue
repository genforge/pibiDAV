<template>
  <div class="file-browser">
    <div class="nc-browser-list">
      <TreeNode
        class="tree with-skeleton"
        :node="node"
        :selected_node="selected_node"
        @node-click="n => toggle_node(n)"
        @load-more="n => load_more(n)"
      />
    </div>
  </div>
</template>

<script>
import TreeNode from "./TreeNode.vue";

export default {
  name: "NcBrowser",
  components: {
    TreeNode
  },
  props: {
    initial_folder: {
      type: String,
      default: "/"
    },
    root_folder: {
      type: String,
      default: "/"
    }
  },
  data() {
    return {
      node: {
        label: this.getLabelFromPath(this.root_folder),
        value: this.root_folder,
        children: [],
        children_start: 0,
        children_loading: false,
        is_leaf: false,
        fetching: false,
        fetched: false,
        open: false
      },
      selected_node: {},
      page_length: 500
    };
  },
  mounted() {
    this.initializeFolder();
  },
  methods: {
    getLabelFromPath(path) {
      // Get the last part of the path for the label
      const parts = path.split('/');
      return parts[parts.length - 1] || '/';
    },
    async initializeFolder() {
      // First toggle the root node
      await this.toggle_node(this.node);
      
      // If initial_folder is different from root_folder, navigate to it
      if (this.initial_folder !== this.root_folder) {
        await this.navigateToFolder(this.initial_folder);
      }
    },
    async navigateToFolder(targetPath) {
      if (!targetPath || targetPath === this.root_folder) return;
      
      // Split the path into segments, removing empty strings
      const pathSegments = targetPath
        .substring(this.root_folder.length)
        .split('/')
        .filter(Boolean);
      
      let currentNode = this.node;
      
      // Navigate through each segment
      for (const segment of pathSegments) {
        // Toggle current node if not already open
        if (!currentNode.open) {
          await this.toggle_node(currentNode);
        }
        
        // Find the next node
        const nextNode = currentNode.children.find(
          child => child.filename === segment || child.label === segment
        );
        
        if (!nextNode) break;
        currentNode = nextNode;
        
        // Toggle the found node
        await this.toggle_node(currentNode);
      }
      
      // Select the final node
      this.select_node(currentNode);
    },
    toggle_node(node) {
      return new Promise((resolve) => {
        if (!node.is_leaf && !node.fetched) {
          node.fetching = true;
          node.children_start = 0;
          node.children_loading = false;
          this.get_files_in_folder(node.value, 0).then(
            ({ files, has_more }) => {
              node.open = true;
              node.children = files;
              node.fetched = true;
              node.fetching = false;
              node.children_start += this.page_length;
              node.has_more_children = has_more;
              this.select_node(node);
              resolve();
            }
          );
        } else {
          node.open = !node.open;
          this.select_node(node);
          resolve();
        }
      });
    },
    load_more(node) {
      if (node.has_more_children) {
        let start = node.children_start;
        node.children_loading = true;
        this.get_files_in_folder(node.value, start).then(
          ({ files, has_more }) => {
            node.children = node.children.concat(files);
            node.children_start += this.page_length;
            node.has_more_children = has_more;
            node.children_loading = false;
          }
        );
      }
    },
    select_node(node) {
      this.selected_node = node;
    },
    get_files_in_folder(folder, start) {
      return frappe
        .call("pibidav.pibidav.custom.get_nc_files_in_folder", {
          folder,
          start,
          page_length: this.page_length
        })
        .then(r => {
          let { files = [], has_more = false } = r.message || {};
          files = files.map(file => this.make_file_node(file));
          return { files, has_more };
        });
    },
    make_file_node(file) {
      let filename = file.file_name || file.name;
      let label = frappe.utils.file_name_ellipsis(filename, 40);
      return {
        label: label,
        filename: filename,
        file_url: file.file_url,
        value: file.name,
        is_leaf: !file.is_folder,
        fetched: !file.is_folder,
        children: [],
        children_loading: false,
        children_start: 0,
        open: false,
        fetching: false
      };
    },
    select_folder() {
      let selected_file = this.selected_node;
      return this.upload_to_folder({
        is_folder: !selected_file.is_leaf,
        file_name: selected_file.filename,
        fileid: selected_file.file_url,
        path: selected_file.value
      });
    },
    upload_to_folder(file) {
      return file;
    }
  }
};
</script>

<style>
.nc-browser-list {
  height: 420px;
  overflow: hidden;
  margin-top: 6px;
}
.tree {
  overflow: auto;
  height: 100%;
  padding-left: 0;
  padding-right: 0;
  padding-bottom: 4rem;
}
</style>