import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../hooks/useActor';
import { loadConfig } from '../config';
import { StorageClient } from './StorageClient';
import { FileReference } from '../backend';
import { HttpAgent } from '@icp-sdk/core/agent';

const getHttpAgent = async () => {
    const config = await loadConfig();

    const agent = new HttpAgent({
        host: config.backend_host
    });
    if (config.backend_host?.includes('localhost')) {
        await agent.fetchRootKey().catch((err) => {
            console.warn('Unable to fetch root key. Check to ensure that your local replica is running');
            console.error(err);
        });
    }
    return agent;
};

// Hook to fetch the list of files
export const useFileList = () => {
    const { actor } = useActor();

    return useQuery({
        queryKey: ['fileList'],
        queryFn: async () => {
            if (!actor) throw new Error('Backend is not available');
            return await actor.listFileReferences();
        },
        enabled: !!actor,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000 // 30 minutes
    });
};

// Unified hook for getting file URLs
export const useFileUrl = (path: string) => {
    const { actor } = useActor();

    const getFileReference = async (path: string) => {
        if (!actor) throw new Error('Backend is not available');
        const envConfig = await loadConfig();
        const storageClient = new StorageClient(
            actor,
            envConfig.bucket_name,
            envConfig.storage_gateway_url,
            envConfig.backend_canister_id,
            envConfig.project_id,
            await getHttpAgent()
        );
        const url = await storageClient.getDirectURL(path);
        return url;
    };

    return useQuery({
        queryKey: ['fileUrl', path],
        queryFn: () => getFileReference(path!),
        enabled: !!path,
        staleTime: Infinity,
        gcTime: 30 * 60 * 1000 // 30 minutes
    });
};

export const useFileUpload = () => {
    const { actor } = useActor();
    const [isUploading, setIsUploading] = useState(false);
    const { invalidateFileList } = useInvalidateQueries();

    const uploadFile = async (
        path: string,
        data: File,
        onProgress?: (percentage: number) => void
    ): Promise<{
        path: string;
        hash: string;
        url: string;
    }> => {
        if (!actor) {
            throw new Error('Backend is not available');
        }

        const envConfig = await loadConfig();
        const storageClient = new StorageClient(
            actor,
            envConfig.bucket_name,
            envConfig.storage_gateway_url,
            envConfig.backend_canister_id,
            envConfig.project_id,
            await getHttpAgent()
        );

        setIsUploading(true);

        try {
            const res = await storageClient.putFile(path, data, onProgress);
            await invalidateFileList();
            return res;
        } finally {
            setIsUploading(false);
        }
    };

    return { uploadFile, isUploading };
};

export const useFileDelete = () => {
    const { actor } = useActor();
    const [isDeleting, setIsDeleting] = useState(false);
    const { invalidateFileList, invalidateFileUrl } = useInvalidateQueries();

    const deleteFile = async (path: string): Promise<void> => {
        if (!actor) {
            throw new Error('Backend is not available');
        }

        setIsDeleting(true);

        try {
            await actor.dropFileReference(path);
            await invalidateFileList();
            invalidateFileUrl(path);
        } finally {
            setIsDeleting(false);
        }
    };

    return { deleteFile, isDeleting };
};

// Utility to invalidate queries
export const useInvalidateQueries = () => {
    const queryClient = useQueryClient();

    return {
        invalidateFileList: () => queryClient.invalidateQueries({ queryKey: ['fileList'] }),
        invalidateFileUrl: (path: string) => queryClient.invalidateQueries({ queryKey: ['fileUrl', path] }),
        invalidateAll: () => {
            queryClient.invalidateQueries({ queryKey: ['fileList'] });
            queryClient.invalidateQueries({ queryKey: ['fileUrl'] });
        }
    };
};
