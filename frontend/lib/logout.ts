import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"

export async function handleLogout() {
    try {
        await signOut(auth)
        console.log("User logged out successfully")
        // Clear any app-specific localStorage items if needed
        // But don't clear everything as Firebase manages its own auth tokens
        return true
    } catch (error) {
        console.error("Error logging out:", error)
        return false
    }
}
