"use client";
import React from 'react'
import { deleteItem } from '../actions/moderatorActions'


const DeleteButton = ({itemID, activeTab} : { itemID: string, activeTab: string}) => {
  return (
    <button
        className={`text-base sm:text-xs bg-red-500 text-white px-3 py-1 rounded-md 
                    opacity-75 group-hover:opacity-100 transition-opacity duration-200 ease-in-out
                    hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50`}
        onClick={() => deleteItem(itemID, activeTab === 'notes' ? 'note' : 'pastPaper')}
    >
        Delete
    </button>
  )
}

export default DeleteButton