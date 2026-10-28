import { createSlice } from "@reduxjs/toolkit";


const userSlice = createSlice({
    name: 'user',
    initialState: {
        userData: null,
        // /me ka check ho chuka hai ya nahi; false tak UI ko login/logout decide nahi karna chahiye
        authChecked: false
    },
    reducers: {
        setUserData: (state, action) => {
            state.userData = action.payload;
            state.authChecked = true;
        }
    }
})

export const { setUserData } = userSlice.actions;

// Selectors: components ko state ka shape (state.user.*) nahi pata hona chahiye
export const selectUserData = (state) => state.user.userData;
export const selectAuthChecked = (state) => state.user.authChecked;

export default userSlice.reducer;