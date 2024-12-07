// Copyright (c) 2022, pibiCo and contributors
// For license information, please see license.txt

frappe.ui.form.on('PibiDAV Addon', {
  refresh(frm) {
    frm.add_custom_button(__("Refresh Files List"), function() {
      frappe.call({
        method: "pibidav.pibidav.custom.update_attachment_item",
        args: {
          dt: frm.doc.ref_doctype,
          dn: frm.doc.ref_docname,
        }
      }).then(function(r) {
        frappe.msgprint(r.message);
        window.location.reload();
      });
    },__('Actions'));
    
    if (frm.doc.nc_folder) {
      frm.add_custom_button(__('Fetch NC Folder Link'), function () {
        frm.trigger('fetch_nc_folder_link');
      }, __('Actions'));
    }
  },
  fetch_nc_folder_link: function (frm) {
        frappe.call({
            method: 'pibidav.pibidav.custom.fetch_nc_folder_internal_link_from_addon',
            args: {
                addon_name: frm.doc.name
            },
            callback: function (r) {
                if (!r.exc) {
                    // Set the fetched link into the `nc_folder_internal_link` field
                    frm.set_value('nc_folder_internal_link', r.message);
                    frm.refresh_field('nc_folder_internal_link');
                    frappe.msgprint(__('NC Folder Internal Link fetched successfully.'));
                } else {
                    frappe.msgprint(__('Failed to fetch NC Folder Internal Link.'));
                }
            }
        });
    }
});
