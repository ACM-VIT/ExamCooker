'use client'

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { updateFile } from '../actions/UpdateFile';

const EditButton = ({ itemID, title, activeTab } : { itemID: string, title: string, activeTab: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);

  const handleEdit = async () => {
    try {
      const result = await updateFile(itemID, editedTitle, activeTab);
      if (result?.success) {
        console.log(`${activeTab} updated successfully:`, result.note);
        
      } else {
        console.error(`Failed to update ${activeTab}:`, result?.error);
      }
    } catch (error) {
      console.error(`Error updating ${activeTab}:`, error);
    } finally {
        setIsOpen(false);
    }
  };


  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-base sm:text-xs bg-blue-500 text-white px-3 py-1 rounded-md 
                    opacity-75 group-hover:opacity-100 transition-opacity duration-200 ease-in-out
                    hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
      >
        Edit
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#C2E6EC] dark:bg-[#0C1222] text-black dark:text-[#D5D5D5] border-2 border-black dark:border-[#D5D5D5]">
          <DialogHeader>
            <DialogTitle className="text-black dark:text-[#D5D5D5]">
              Edit {activeTab === 'notes' ? 'Note' : 'Past Paper'}
            </DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            placeholder="Enter new title"
            className="w-full px-3 py-2 border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] text-black dark:text-[#D5D5D5] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <DialogFooter className="flex justify-end space-x-2 mt-4">
            {editedTitle !== title && <button
              onClick={handleEdit}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none"
                >
              Save
            </button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditButton;
