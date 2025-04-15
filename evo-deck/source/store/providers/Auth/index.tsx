"use client";

import { useEffect, useState } from "react";

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { z } from "zod";

import { UserEntity as UserDoc } from "@/common/entities/user";
import  firebaseApp  from '@/source/config/firebase'
import { errorToast, successToast } from "@/source/hooks/useAppToast";
import {
  createUserWithEmailAndPasswordLocal,

  logOut,

  signInWithEmailAndPasswordLocal
} from "@/source/store/services/auth";
import {
  createNewUserDoc,
  waitForUser
} from "@/source/store/services/user";
import SignUpForm from "@/validations/signUp";

import AuthContext from "./context";

interface Props {
  children: React.ReactNode;
}

export type UserType = UserDoc | null;
type SignUpFormValidationData = z.infer<typeof SignUpForm>;

const AuthProvider = ({ children }: Props) => {
  const initialLoadingObject = {
    onAuthUserChanged: true,
    loginWithInternalService: false,
    createUserWithInternalService: false,
    logout: false
  };
  const [userUid, setUserUid] = useState<string>("");
  const [loading, setLoading] = useState(initialLoadingObject);
  const router = useRouter();
  const auth = getAuth(firebaseApp);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUid(user.uid);
      } else {
        setUserUid("");
      }
      setLoading((prev) => ({ ...prev, onAuthUserChanged: true }));
    });

    return () => unsubscribe();
  }, []);

 
  const loginWithInternalService = async (email: string, password: string) => {
    setLoading((prev) => ({ ...prev, loginWithInternalService: true }));
    const { error, user } = await signInWithEmailAndPasswordLocal(
      email,
      password
    );
    if (user && !user?.emailVerified) {
      errorToast("Por favor verifique seu email");
      setLoading((prev) => ({ ...prev, loginWithInternalService: false }));
      logOut();
      return;
    }
    if (user) {
      successToast("Bem vindo de volta!");
      setUserUid(user.uid);
    } else {
      setUserUid("");
      errorToast(error);
    }
    setLoading((prev) => ({ ...prev, loginWithInternalService: false }));
  };

  const createUserWithInternalService = async ({
    email,
    password,
    name,
    username
  }: SignUpFormValidationData) => {
    if (email && password) {
      setLoading((prev) => ({ ...prev, createUserWithInternalService: true }));
      const { error, user } = await createUserWithEmailAndPasswordLocal(
        email,
        password
      );
      if (error) {
        errorToast(error);
        setLoading((prev) => ({
          ...prev,
          createUserWithInternalService: false
        }));
        return;
      }
      await createNewUserDoc({
        email,
        name,
        username,
        password,
      });
      setUserUid(user?.uid || "");
      toast("Conta criada! Enviamos um email de confirmação ao seu email", {
        type: "success"
      });
      router.push("/login");
      setLoading((prev) => ({ ...prev, createUserWithInternalService: false }));
    } else {
      errorToast("Email e senha inválidos");
    }
  };

  const waitForUserSync = async () => {
    setLoading((prev) => ({ ...prev, onAuthUserChanged: true }));
    await waitForUser(async (userCred) => {
      if (userCred && !userCred?.emailVerified) {
        logOut();
        setLoading((prev) => ({ ...prev, onAuthUserChanged: false }));
      }
    });
    setLoading((prev) => ({ ...prev, onAuthUserChanged: false }));
  };
 

 

  const logoutUser = async () => {
    setLoading((prev) => ({ ...prev, logout: true }));
    router.push("/login");
    setUserUid("");
    logOut();
    setLoading((prev) => ({ ...prev, logout: false }));
  };

  return (
    <AuthContext.Provider
      value={{
        userUid,
        loading,
        loginWithInternalService,
        logoutUser,
        setUserUid,
        createUserWithInternalService,
        waitForUserSync
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
