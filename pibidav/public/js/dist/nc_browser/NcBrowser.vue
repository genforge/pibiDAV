<template>
  <div class="file-browser">
    <div class="border-b border-gray-200 px-3 py-2 flex justify-between items-center">
      <div class="text-sm text-gray-600">{{ selected_node.value || '/' }}</div>
      <div class="flex gap-2">
        <button v-if="selected_node && !selected_node.is_leaf" 
                class="btn btn-sm btn-primary mr-1" 
                @click="showCreateFolderDialog"
                title="Crea Carpeta | Create Folder">
          <span v-html="folderPlusIcon"></span>
        </button>
        <button v-if="selected_node && selected_node.value"
                class="btn btn-sm btn-primary ml-1" 
                @click="openInNextCloud"
                title="Abrir en NextCloud | Open in NextCloud">
          <span v-html="externalLinkIcon"></span>
        </button>
      </div>
    </div>
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
  computed: {
    folderPlusIcon() {
      return frappe.utils.icon('folder-plus', 'sm');
    },
    externalLinkIcon() {
      return frappe.utils.icon('external-link', 'sm');
    }
  },
  mounted() {
    this.initializeFolder();
  },
  methods: {
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
    },
    async openInNextCloud() {
      if (!this.selected_node?.value) return;
      
      try {
        const nc_url = await frappe.db.get_single_value('NextCloud Settings', 'nc_backup_url');
        if (!nc_url) {
          frappe.throw(__('NextCloud URL not configured'));
          return;
        }

        const baseUrl = nc_url.endsWith('/') ? nc_url : nc_url + '/';
        let viewUrl;

        if (this.selected_node.is_leaf) {
          // For files, open directly using the fileId
          viewUrl = baseUrl + 'apps/files/?fileid=' + this.selected_node.file_url;
        } else {
          // For folders, open the directory view
          viewUrl = baseUrl + 'apps/files/?dir=' + encodeURIComponent(this.selected_node.value);
        }
        
        window.open(viewUrl, '_blank');
      } catch (error) {
        frappe.throw(__('Error opening NextCloud: ') + error.message);
      }
    },
    getLabelFromPath(path) {
      const parts = path.split('/');
      return parts[parts.length - 1] || '/';
    },
    async initializeFolder() {
      await this.toggle_node(this.node);
      
      if (this.initial_folder !== this.root_folder) {
        await this.navigateToFolder(this.initial_folder);
      }
    },
    async navigateToFolder(targetPath) {
      if (!targetPath || targetPath === this.root_folder) return;
      
      const pathSegments = targetPath
        .substring(this.root_folder.length)
        .split('/')
        .filter(Boolean);
      
      let currentNode = this.node;
      
      for (const segment of pathSegments) {
        if (!currentNode.open) {
          await this.toggle_node(currentNode);
        }
        
        const nextNode = currentNode.children.find(
          child => child.filename === segment || child.label === segment
        );
        
        if (!nextNode) break;
        currentNode = nextNode;
        await this.toggle_node(currentNode);
      }
      
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
    async showCreateFolderDialog() {
      if (!this.selected_node || this.selected_node.is_leaf) return;

      const d = new frappe.ui.Dialog({
        title: __('Create New Folder'),
        fields: [
          {
            label: __('Folder Name'),
            fieldname: 'folder_name',
            fieldtype: 'Data',
            reqd: 1
          }
        ],
        primary_action_label: __('Create'),
        primary_action: async (values) => {
          try {
            await this.createFolder(this.selected_node.value, values.folder_name);
            d.hide();
          } catch (error) {
            frappe.throw(__(error.message));
          }
        }
      });
      d.show();
    },
    async createFolder(parentPath, folderName) {
      const response = await frappe.call({
        method: 'pibidav.pibidav.custom.create_nc_subfolder',
        args: {
          parent_folder: parentPath,
          folder_name: folderName
        }
      });

      if (response.exc) {
        throw new Error('Failed to create folder');
      }

      this.selected_node.fetched = false;
      await this.toggle_node(this.selected_node);

      frappe.show_alert({
        message: __('Folder created successfully'),
        indicator: 'green'
      });
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