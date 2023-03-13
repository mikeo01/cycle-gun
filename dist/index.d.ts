import { IGunChain, IGunUserInstance } from "gun";
import "gun/sea";
import { MemoryStream, Stream } from "xstream";
export interface GunSource {
    user$: Stream<IGunUserInstance>;
    error$: Stream<string>;
    signUp$: Stream<boolean>;
    get: (table: string) => MemoryStream<IGunChain<any, any, any, any>>;
}
interface UserSignIn {
    username: string;
    password: string;
}
interface Get {
    table: string;
}
interface Set {
    table: IGunChain<any, any, any, any>;
    id?: string;
    data: any;
}
export type Request = "make-user" | "sign-in" | "sign-out" | "get" | "set" | "put";
type Payload = UserSignIn | Get | Set | null | undefined;
export interface GunSink {
    action: Request;
    payload: Payload;
}
export declare const makeGunDriver: (peers?: string[]) => (stream$: Stream<GunSink>) => GunSource;
export {};
